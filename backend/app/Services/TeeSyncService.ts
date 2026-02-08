import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { config as loadDotenv } from 'dotenv'
import { Contract, JsonRpcProvider, ZeroAddress } from 'ethers'
import { IExecDataProtector, getWeb3Provider } from '@iexec/dataprotector'

type SyncEventKind = 'subscribed' | 'signal-published' | 'season-closed'

type SyncQueueItem = {
  kind: SyncEventKind
  log: any
}

type PersistentState = {
  lastSyncedBlock: number
}

type RuntimeStats = {
  running: boolean
  startedAt: number | null
  lastSyncedBlock: number | null
  eventsProcessed: number
  grantsApplied: number
  grantsSkipped: number
  errors: number
  lastError: string | null
}

const SHINGO_HUB_ABI = [
  'event Subscribed(address indexed subscriber, address indexed trader, uint256 indexed seasonId, uint256 amountToken)',
  'event SignalPublished(address indexed trader, uint256 indexed seasonId, uint256 indexed signalId, string protectedDataAddr)',
  'event SeasonClosed(address indexed trader, uint256 indexed seasonId)',
  'function getSeasonSignalIds(uint256 seasonId) view returns (uint256[])',
  'function getSeasonSubscribers(uint256 seasonId) view returns (address[])',
  'function getSignal(uint256 signalId) view returns (tuple(uint256 id,uint256 seasonId,address trader,string protectedDataAddr,uint256 publishedAt))',
]

const STATE_FILE_PATH = path.resolve(process.cwd(), 'tmp/tee-sync-state.json')
const ENV_PATHS = [path.resolve(process.cwd(), '../evm/.env'), path.resolve(process.cwd(), '.env')]

let envLoaded = false
let singleton: TeeSyncService | null = null

function ensureEnvLoaded() {
  if (envLoaded) {
    return
  }

  // Support both monorepo root (evm/.env) and backend-only deployments (backend/.env).
  for (const envPath of ENV_PATHS) {
    loadDotenv({ path: envPath, override: false })
  }
  envLoaded = true
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false
  }
  return defaultValue
}

function parseChainId(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.trunc(parsed)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAlreadyGrantedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const causeMessage =
    typeof (error as { cause?: unknown })?.cause === 'object'
      ? String((error as { cause?: { message?: unknown } }).cause?.message ?? '')
      : ''
  const merged = `${message} ${causeMessage}`.toLowerCase()
  return /already granted|already exists|duplicate|already has access|already authorized/.test(
    merged
  )
}

export class TeeSyncService {
  private readonly provider: JsonRpcProvider
  private readonly hub: Contract
  private readonly dataProtector: IExecDataProtector
  private readonly teeAppAddress: string
  private readonly startBlockDelta: number
  private readonly catchupIntervalMs: number
  private readonly liveListenersEnabled: boolean

  private readonly processedLogIds = new Set<string>()
  private readonly stats: RuntimeStats = {
    running: false,
    startedAt: null,
    lastSyncedBlock: null,
    eventsProcessed: 0,
    grantsApplied: 0,
    grantsSkipped: 0,
    errors: 0,
    lastError: null,
  }

  private catchupInFlight = false
  private intervalHandle: NodeJS.Timeout | null = null

  constructor() {
    ensureEnvLoaded()

    const rpcUrl =
      process.env.IEXEC_RPC_URL ||
      process.env.ARBITRUM_SEPOLIA_RPC_URL ||
      process.env.ARBITRUM_RPC_URL ||
      'https://sepolia-rollup.arbitrum.io/rpc'
    const hubAddress = process.env.SHINGO_HUB_ADDRESS
    const relayPrivateKey = process.env.RELAY_PRIVATE_KEY
    const teeAppAddress = process.env.IEXEC_TEE_APP

    if (!hubAddress || !relayPrivateKey || !teeAppAddress || teeAppAddress === '0x') {
      throw new Error(
        'Missing env for TeeSyncService. Required: SHINGO_HUB_ADDRESS, RELAY_PRIVATE_KEY, IEXEC_TEE_APP (set in backend/.env or evm/.env)'
      )
    }

    const chainId = parseChainId(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID, 421614)
    const chainName = chainId === 421614 ? 'arbitrum-sepolia' : chainId === 42161 ? 'arbitrum' : 'evm'

    this.provider = new JsonRpcProvider(
      rpcUrl,
      {
        chainId,
        name: chainName,
      },
      {
        staticNetwork: true,
        pollingInterval: 20_000,
      }
    )
    this.hub = new Contract(hubAddress, SHINGO_HUB_ABI, this.provider)
    this.dataProtector = new IExecDataProtector(getWeb3Provider(relayPrivateKey, { host: rpcUrl }), {
      allowExperimentalNetworks: true,
    })
    this.teeAppAddress = teeAppAddress

    this.startBlockDelta = Number(process.env.TEE_SYNC_START_BLOCK_DELTA || '4000')
    this.catchupIntervalMs = Number(process.env.TEE_SYNC_CATCHUP_INTERVAL_MS || '30000')
    this.liveListenersEnabled = parseBoolean(process.env.TEE_SYNC_LIVE_LISTENERS, false)
  }

  public getStatus() {
    return {
      ...this.stats,
      startedAtIso: this.stats.startedAt ? new Date(this.stats.startedAt).toISOString() : null,
      processedLogCacheSize: this.processedLogIds.size,
      catchupInFlight: this.catchupInFlight,
      catchupIntervalMs: this.catchupIntervalMs,
      startBlockDelta: this.startBlockDelta,
    }
  }

  public async start() {
    if (this.stats.running) {
      return
    }

    this.stats.running = true
    this.stats.startedAt = Date.now()
    await this.catchUpNow()
    if (this.liveListenersEnabled) {
      this.attachLiveListeners()
    }
    this.intervalHandle = setInterval(() => {
      void this.catchUpNow()
    }, this.catchupIntervalMs)
  }

  public async stop() {
    if (!this.stats.running) {
      return
    }

    this.stats.running = false
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this.hub.removeAllListeners('Subscribed')
    this.hub.removeAllListeners('SignalPublished')
    this.hub.removeAllListeners('SeasonClosed')
  }

  public async catchUpNow() {
    if (this.catchupInFlight || !this.stats.running) {
      return this.getStatus()
    }

    this.catchupInFlight = true
    try {
      await this.runCatchUp()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.stats.errors += 1
      this.stats.lastError = message
      // eslint-disable-next-line no-console
      console.error('[tee-sync] catch-up failed:', message)
    } finally {
      this.catchupInFlight = false
    }

    return this.getStatus()
  }

  private attachLiveListeners() {
    this.hub.on('Subscribed', (...args: any[]) => {
      void this.handleLiveEvent('subscribed', args[args.length - 1])
    })
    this.hub.on('SignalPublished', (...args: any[]) => {
      void this.handleLiveEvent('signal-published', args[args.length - 1])
    })
    this.hub.on('SeasonClosed', (...args: any[]) => {
      void this.handleLiveEvent('season-closed', args[args.length - 1])
    })
  }

  private async handleLiveEvent(kind: SyncEventKind, log: any) {
    if (!this.stats.running) {
      return
    }
    const logId = this.getLogId(log)
    if (this.processedLogIds.has(logId)) {
      return
    }
    this.processedLogIds.add(logId)

    try {
      await this.processQueueItem({ kind, log })
      await this.updateLastSyncedBlock(Number(log.blockNumber))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.stats.errors += 1
      this.stats.lastError = message
      this.processedLogIds.delete(logId)
      // eslint-disable-next-line no-console
      console.error(`[tee-sync] live event failed (${kind}):`, message)
    }
  }

  private async runCatchUp() {
    const latestBlock = await this.provider.getBlockNumber()
    const lastState = await this.readState()
    const fromBlock =
      lastState?.lastSyncedBlock !== undefined
        ? lastState.lastSyncedBlock + 1
        : Math.max(0, latestBlock - this.startBlockDelta)

    if (fromBlock > latestBlock) {
      return
    }

    const [subscribedLogs, signalPublishedLogs, seasonClosedLogs] = await Promise.all([
      this.hub.queryFilter(this.hub.filters.Subscribed(), fromBlock, latestBlock),
      this.hub.queryFilter(this.hub.filters.SignalPublished(), fromBlock, latestBlock),
      this.hub.queryFilter(this.hub.filters.SeasonClosed(), fromBlock, latestBlock),
    ])

    const queue: SyncQueueItem[] = []
    for (const log of subscribedLogs as any[]) {
      queue.push({ kind: 'subscribed', log })
    }
    for (const log of signalPublishedLogs as any[]) {
      queue.push({ kind: 'signal-published', log })
    }
    for (const log of seasonClosedLogs as any[]) {
      queue.push({ kind: 'season-closed', log })
    }

    queue.sort((a, b) => {
      const blockDiff = Number(a.log.blockNumber) - Number(b.log.blockNumber)
      if (blockDiff !== 0) {
        return blockDiff
      }
      return Number(a.log.index) - Number(b.log.index)
    })

    let lastProcessedBlock = lastState?.lastSyncedBlock ?? fromBlock - 1

    for (const item of queue) {
      const logId = this.getLogId(item.log)
      if (this.processedLogIds.has(logId)) {
        lastProcessedBlock = Math.max(lastProcessedBlock, Number(item.log.blockNumber))
        continue
      }

      try {
        await this.processQueueItem(item)
        this.processedLogIds.add(logId)
        lastProcessedBlock = Math.max(lastProcessedBlock, Number(item.log.blockNumber))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.stats.errors += 1
        this.stats.lastError = message
        // Continue: catch-up should not stop on one failing event.
        // eslint-disable-next-line no-console
        console.error(`[tee-sync] catch-up event failed (${item.kind}):`, message)
      }
    }

    await this.updateLastSyncedBlock(Math.max(lastProcessedBlock, latestBlock))
  }

  private async processQueueItem(item: SyncQueueItem) {
    if (item.kind === 'subscribed') {
      const seasonId = this.toBigInt(item.log.args?.seasonId)
      const subscriber = String(item.log.args?.subscriber ?? '').trim()
      if (seasonId > 0n && subscriber) {
        await this.syncSubscriberForSeason(seasonId, subscriber)
      }
    } else if (item.kind === 'signal-published') {
      const seasonId = this.toBigInt(item.log.args?.seasonId)
      const protectedDataAddr = String(item.log.args?.protectedDataAddr ?? '').trim()
      if (seasonId > 0n && protectedDataAddr) {
        await this.syncSignalToSeasonSubscribers(seasonId, protectedDataAddr)
      }
    } else if (item.kind === 'season-closed') {
      const seasonId = this.toBigInt(item.log.args?.seasonId)
      if (seasonId > 0n) {
        await this.publicizeSeason(seasonId)
      }
    }

    this.stats.eventsProcessed += 1
  }

  private async syncSubscriberForSeason(seasonId: bigint, subscriber: string) {
    const signalIds = (await this.hub.getSeasonSignalIds(seasonId)) as bigint[]
    for (const signalId of signalIds) {
      const signal = await this.hub.getSignal(signalId)
      await this.grantAccessSafely(String(signal.protectedDataAddr), subscriber)
    }
  }

  private async syncSignalToSeasonSubscribers(seasonId: bigint, protectedDataAddr: string) {
    const subscribers = await this.getSeasonSubscribers(seasonId)
    for (const subscriber of subscribers) {
      await this.grantAccessSafely(protectedDataAddr, subscriber)
    }
  }

  private async publicizeSeason(seasonId: bigint) {
    const signalIds = (await this.hub.getSeasonSignalIds(seasonId)) as bigint[]
    for (const signalId of signalIds) {
      const signal = await this.hub.getSignal(signalId)
      await this.grantAccessSafely(String(signal.protectedDataAddr), ZeroAddress)
    }
  }

  private async getSeasonSubscribers(seasonId: bigint): Promise<string[]> {
    try {
      const subscribers = (await this.hub.getSeasonSubscribers(seasonId)) as string[]
      return subscribers
    } catch {
      const logs = await this.hub.queryFilter(this.hub.filters.Subscribed(null, null, seasonId), 0, 'latest')
      const unique = new Set<string>()
      for (const log of logs as any[]) {
        const subscriber = String(log.args?.subscriber ?? '').trim()
        if (subscriber) {
          unique.add(subscriber.toLowerCase())
        }
      }
      return Array.from(unique)
    }
  }

  private async grantAccessSafely(protectedData: string, authorizedUser: string) {
    const callGrantAccess = async () => {
      await this.dataProtector.core.grantAccess({
        protectedData,
        authorizedApp: this.teeAppAddress,
        authorizedUser,
        allowBulk: authorizedUser === ZeroAddress,
      })
    }

    try {
      await callGrantAccess()
      this.stats.grantsApplied += 1
      return
    } catch (error) {
      if (isAlreadyGrantedError(error)) {
        this.stats.grantsSkipped += 1
        return
      }
    }

    // Retry transient failures (RPC/network/orderbook lag).
    for (let retry = 1; retry <= 3; retry += 1) {
      await sleep(retry * 1000)
      try {
        await callGrantAccess()
        this.stats.grantsApplied += 1
        return
      } catch (error) {
        if (isAlreadyGrantedError(error)) {
          this.stats.grantsSkipped += 1
          return
        }
        if (retry === 3) {
          throw error
        }
      }
    }
  }

  private toBigInt(value: unknown): bigint {
    try {
      return BigInt(String(value))
    } catch {
      return 0n
    }
  }

  private getLogId(log: any) {
    const txHash = String(log?.transactionHash ?? '')
    const index = String(log?.index ?? '')
    return `${txHash}:${index}`
  }

  private async ensureStateDir() {
    const stateDir = path.dirname(STATE_FILE_PATH)
    if (!existsSync(stateDir)) {
      await fs.mkdir(stateDir, { recursive: true })
    }
  }

  private async readState(): Promise<PersistentState | null> {
    try {
      const raw = await fs.readFile(STATE_FILE_PATH, 'utf8')
      const parsed = JSON.parse(raw) as PersistentState
      if (typeof parsed.lastSyncedBlock !== 'number' || !Number.isFinite(parsed.lastSyncedBlock)) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  private async writeState(state: PersistentState) {
    await this.ensureStateDir()
    await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8')
  }

  private async updateLastSyncedBlock(block: number) {
    this.stats.lastSyncedBlock = block
    await this.writeState({ lastSyncedBlock: block })
  }
}

export async function ensureTeeSyncServiceStarted() {
  ensureEnvLoaded()
  if (!parseBoolean(process.env.TEE_SYNC_ENABLED, false)) {
    return null
  }

  if (!singleton) {
    singleton = new TeeSyncService()
  }
  await singleton.start()
  return singleton
}

export function getTeeSyncService() {
  return singleton
}

export async function stopTeeSyncService() {
  if (!singleton) {
    return
  }
  await singleton.stop()
}
