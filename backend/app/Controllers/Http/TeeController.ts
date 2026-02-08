import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import path from 'path'
import { config as loadDotenv } from 'dotenv'
import { IExecDataProtector, getWeb3Provider } from '@iexec/dataprotector'
import { Contract, JsonRpcProvider, ZeroAddress } from 'ethers'
import { IExec } from 'iexec'
import JSZip from 'jszip'
import { ensureTeeSyncServiceStarted, getTeeSyncService } from 'App/Services/TeeSyncService'

let envLoaded = false
let dataProtectorInstance: IExecDataProtector | null = null
let hubContractInstance: Contract | null = null
let teeAppAddress: string | null = null
let iexecInstance: IExec | null = null
const ENV_PATHS = [path.resolve(process.cwd(), '../evm/.env'), path.resolve(process.cwd(), '.env')]

const SHINGO_HUB_ABI = [
  'function isSubscribed(address subscriber, uint256 seasonId) view returns (bool)',
  'function isSignalPublic(uint256 signalId) view returns (bool)',
  'function getSeasonSignalIds(uint256 seasonId) view returns (uint256[])',
  'function getSeasonSubscribers(uint256 seasonId) view returns (address[])',
  'function getSignal(uint256 signalId) view returns (tuple(uint256 id,uint256 seasonId,address trader,string protectedDataAddr,uint256 publishedAt))',
  'event Subscribed(address indexed subscriber, address indexed trader, uint256 indexed seasonId, uint256 amountToken)',
]

function ensureEnvLoaded() {
  if (envLoaded) {
    return
  }

  // Load both monorepo and backend-local env files (first one wins, no override).
  for (const envPath of ENV_PATHS) {
    loadDotenv({ path: envPath, override: false })
  }
  envLoaded = true
}

function parseSeasonId(input: unknown): bigint | null {
  if (typeof input === 'bigint') {
    return input > 0n ? input : null
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) {
      return null
    }
    return BigInt(Math.trunc(input))
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      return null
    }
    try {
      const value = BigInt(trimmed)
      return value > 0n ? value : null
    } catch {
      return null
    }
  }

  return null
}

function parseAddress(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }
  const trimmed = input.trim()
  if (!trimmed || !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return null
  }
  return trimmed
}

function parseSignalId(input: unknown): bigint | null {
  return parseSeasonId(input)
}

const SIGNAL_NUMERIC_FIELDS = [
  'side',
  'entryKind',
  'entryPrice',
  'stopLoss',
  'takeProfitPrice',
  'takeProfitSize',
  'sizeUsd',
  'leverage',
  'venue',
  'timeframe',
  // Legacy aliases
  'entry',
  'stop',
  'takeProfit',
] as const

const SIGNAL_REQUIRED_STRING_FIELDS = [
  'market',
  'marketBase',
  'marketQuote',
  'sideLabel',
  'entryKindLabel',
  'venueLabel',
  'timeframeLabel',
  'seasonId',
  'timestamp',
] as const

function normalizeSignalPayload(payload: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...payload }

  for (const field of SIGNAL_NUMERIC_FIELDS) {
    const current = normalized[field]
    if (typeof current === 'string') {
      const trimmed = current.trim().replace(',', '.')
      if (trimmed !== '') {
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) {
          normalized[field] = parsed
        }
      }
    }
  }

  return normalized
}

function looksLikeSignalPayload(payload: Record<string, unknown>) {
  return (
    'market' in payload ||
    'entryPrice' in payload ||
    'sideLabel' in payload ||
    'venueLabel' in payload ||
    'timeframeLabel' in payload
  )
}

function validateSignalPayload(payload: Record<string, unknown>) {
  const missingStrings: string[] = []
  const invalidNumbers: string[] = []

  for (const field of SIGNAL_REQUIRED_STRING_FIELDS) {
    const value = payload[field]
    if (typeof value !== 'string' || value.trim() === '') {
      missingStrings.push(field)
    }
  }

  for (const field of SIGNAL_NUMERIC_FIELDS) {
    const value = payload[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      invalidNumbers.push(field)
    }
  }

  return {
    valid: missingStrings.length === 0 && invalidNumbers.length === 0,
    missingStrings,
    invalidNumbers,
  }
}

function getRpcUrl() {
  return (
    process.env.IEXEC_RPC_URL ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.ARBITRUM_RPC_URL ||
    'https://sepolia-rollup.arbitrum.io/rpc'
  )
}

function extractErrorMessages(input: unknown, depth = 0, seen = new Set<unknown>()): string[] {
  if (!input || depth > 4 || seen.has(input)) {
    return []
  }
  seen.add(input)

  if (typeof input === 'string') {
    return [input]
  }

  if (input instanceof Error) {
    const nested = [
      ...extractErrorMessages(input.cause, depth + 1, seen),
      ...extractErrorMessages((input as unknown as { originalError?: unknown }).originalError, depth + 1, seen),
      ...extractErrorMessages((input as unknown as { info?: unknown }).info, depth + 1, seen),
    ]
    return [input.message, ...nested].filter(Boolean)
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>
    const own = typeof obj.message === 'string' ? [obj.message] : []
    const nested = [
      ...extractErrorMessages(obj.error, depth + 1, seen),
      ...extractErrorMessages(obj.cause, depth + 1, seen),
      ...extractErrorMessages(obj.originalError, depth + 1, seen),
      ...extractErrorMessages(obj.info, depth + 1, seen),
      ...extractErrorMessages(obj.reason, depth + 1, seen),
    ]
    return [...own, ...nested].filter(Boolean)
  }

  return []
}

function toReadableError(error: unknown): string {
  const messages = extractErrorMessages(error)
  const merged = messages.join(' | ') || String(error)
  const lowercase = merged.toLowerCase()
  const gasDetail =
    messages.find((msg) => /insufficient funds|intrinsic transaction cost|gas \* price/i.test(msg)) ??
    messages[0] ??
    merged

  if (lowercase.includes('insufficient funds') && lowercase.includes('gas')) {
    return `Relay wallet has insufficient ETH for gas on Arbitrum Sepolia. Top up relay ETH and retry. Details: ${gasDetail}`
  }
  if (lowercase.includes('nrlc too low')) {
    return messages[0] ?? merged
  }
  if (lowercase.includes('429') || lowercase.includes('too many requests')) {
    return 'Arbitrum RPC rate-limited (429). Configure a dedicated RPC endpoint in evm/.env and retry.'
  }
  if (lowercase.includes('failed to process protected data') && messages.length > 1) {
    return messages.find((msg) => !/failed to process protected data/i.test(msg)) ?? messages[0]
  }

  return messages[0] ?? merged
}

function isAlreadyGrantedError(error: unknown): boolean {
  const messages = extractErrorMessages(error)
  const merged = messages.join(' | ').toLowerCase()
  return /already granted|already exists|duplicate|already has access|already authorized/.test(
    merged
  )
}

function getChainConfig() {
  const rawChainId = process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '421614'
  const parsed = Number(rawChainId)
  const chainId = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 421614
  const name = chainId === 421614 ? 'arbitrum-sepolia' : chainId === 42161 ? 'arbitrum' : 'evm'
  return { chainId, name }
}

function getDataProtector() {
  ensureEnvLoaded()

  if (dataProtectorInstance) {
    return dataProtectorInstance
  }

  const relayPrivateKey = process.env.RELAY_PRIVATE_KEY
  if (!relayPrivateKey || relayPrivateKey === '0x') {
    throw new Error('Missing RELAY_PRIVATE_KEY. Set it in backend/.env or evm/.env')
  }

  const web3Provider = getWeb3Provider(relayPrivateKey, { host: getRpcUrl() })
  dataProtectorInstance = new IExecDataProtector(web3Provider, {
    allowExperimentalNetworks: true,
  })
  return dataProtectorInstance
}

function getHubContract() {
  ensureEnvLoaded()

  if (hubContractInstance) {
    return hubContractInstance
  }

  const shingoHubAddress = process.env.SHINGO_HUB_ADDRESS
  if (!shingoHubAddress || shingoHubAddress === '0x') {
    throw new Error('Missing SHINGO_HUB_ADDRESS. Set it in backend/.env or evm/.env')
  }

  const chain = getChainConfig()
  const provider = new JsonRpcProvider(
    getRpcUrl(),
    { chainId: chain.chainId, name: chain.name },
    { staticNetwork: true, pollingInterval: 15_000 }
  )
  hubContractInstance = new Contract(shingoHubAddress, SHINGO_HUB_ABI, provider)
  return hubContractInstance
}

function getTeeAppAddress() {
  ensureEnvLoaded()

  if (teeAppAddress) {
    return teeAppAddress
  }

  const app = process.env.IEXEC_TEE_APP
  if (!app || app === '0x') {
    throw new Error('Missing IEXEC_TEE_APP. Set it in backend/.env or evm/.env')
  }

  teeAppAddress = app
  return teeAppAddress
}

function getIexec() {
  ensureEnvLoaded()

  if (iexecInstance) {
    return iexecInstance
  }

  const relayPrivateKey = process.env.RELAY_PRIVATE_KEY
  if (!relayPrivateKey || relayPrivateKey === '0x') {
    throw new Error('Missing RELAY_PRIVATE_KEY. Set it in backend/.env or evm/.env')
  }

  const web3Provider = getWeb3Provider(relayPrivateKey, { host: getRpcUrl() })
  iexecInstance = new IExec({ ethProvider: web3Provider })
  return iexecInstance
}

async function grantAccessSafely(
  protectedData: string,
  authorizedUser: string,
  authorizedApp?: string
) {
  const dataProtector = getDataProtector()
  const app = authorizedApp || getTeeAppAddress()

  try {
    await dataProtector.core.grantAccess({
      protectedData,
      authorizedApp: app,
      authorizedUser,
      allowBulk: authorizedUser === ZeroAddress,
    })
    return true
  } catch (error) {
    if (isAlreadyGrantedError(error)) {
      return false
    }
    throw error
  }
}

async function findTriplet(args: {
  iexec: IExec
  protectedData: string
  app: string
  requester: string
}) {
  const { iexec, protectedData, app, requester } = args
  const [datasetOrderbook, appOrderbook, workerpoolOrderbook] = await Promise.all([
    iexec.orderbook.fetchDatasetOrderbook({
      dataset: protectedData,
      app,
      requester,
    }),
    iexec.orderbook.fetchAppOrderbook({
      app,
      minTag: ['tee', 'scone'],
      maxTag: ['tee', 'scone'],
    }),
    iexec.orderbook.fetchWorkerpoolOrderbook({
      app,
      dataset: protectedData,
      requester,
      minTag: ['tee', 'scone'],
      category: 0,
    }),
  ])

  const datasetOrder = datasetOrderbook.orders[0]?.order
  const appOrder = appOrderbook.orders[0]?.order
  const workerpoolOrder = workerpoolOrderbook.orders[0]?.order
  if (!datasetOrder || !appOrder || !workerpoolOrder) {
    return null
  }

  return {
    datasetOrder,
    appOrder,
    workerpoolOrder,
  }
}

async function ensureAppOrderPublished(iexec: IExec, app: string) {
  const existing = await iexec.orderbook.fetchAppOrderbook({
    app,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
  })
  if (existing.orders.length > 0) {
    return
  }

  const owner = await iexec.wallet.getAddress()
  const appDetails = await iexec.app.showApp(app)
  if (appDetails.app.owner.toLowerCase() !== owner.toLowerCase()) {
    return
  }

  const template = await iexec.order.createApporder({
    app,
    appprice: '0',
    volume: '1000000',
    tag: ['tee', 'scone'],
  })
  const signed = await iexec.order.signApporder(template, { preflightCheck: false })
  await iexec.order.publishApporder(signed, { preflightCheck: false })
}

async function getSeasonSubscribersFallback(hub: Contract, seasonId: bigint): Promise<string[]> {
  try {
    const subscribers = (await hub.getSeasonSubscribers(seasonId)) as string[]
    return subscribers
  } catch {
    const logs = await hub.queryFilter(hub.filters.Subscribed(null, null, seasonId), 0, 'latest')
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

async function isSubscribedFallback(hub: Contract, seasonId: bigint, subscriber: string): Promise<boolean> {
  try {
    return (await hub.isSubscribed(subscriber, seasonId)) as boolean
  } catch {
    const logs = await hub.queryFilter(
      hub.filters.Subscribed(subscriber, null, seasonId),
      0,
      'latest'
    )
    return logs.length > 0
  }
}

async function decodeArrayBufferResult(buffer: ArrayBuffer): Promise<unknown> {
  const raw = Buffer.from(buffer)
  // iExec often returns a zip archive containing result.json/computed.json
  if (raw.length >= 2 && raw[0] === 0x50 && raw[1] === 0x4b) {
    try {
      const zip = await JSZip.loadAsync(raw)
      const resultFile = zip.file('result.json') || zip.file('computed.json')
      if (resultFile) {
        const jsonText = (await resultFile.async('text')).trim()
        if (jsonText) {
          try {
            return JSON.parse(jsonText)
          } catch {
            return jsonText
          }
        }
      }

      const firstJson = Object.values(zip.files).find((file) => !file.dir && file.name.endsWith('.json'))
      if (firstJson) {
        const jsonText = (await firstJson.async('text')).trim()
        if (jsonText) {
          try {
            return JSON.parse(jsonText)
          } catch {
            return jsonText
          }
        }
      }
    } catch {
      // fallback to plain text decoding below
    }
  }

  const text = raw.toString('utf8').trim()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toBigIntAmount(value: { toString(): string } | string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value
  }
  return BigInt(value.toString())
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function protectDataWithRetry(
  dataProtector: IExecDataProtector,
  payload: Record<string, unknown>,
  name: string
) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await dataProtector.core.protectData({
        data: payload,
        name,
      })
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const isTransient = /timeout|429|502|503|gateway|network|temporar|etimedout|econnreset|socket/i.test(
        message
      )

      if (!isTransient || attempt === 3) {
        break
      }

      await sleep(attempt * 800)
    }
  }

  throw lastError
}

function isLikelySignalPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const obj = payload as Record<string, unknown>
  const hasMarket = typeof obj.market === 'string' && obj.market.length > 0
  const hasDirection = obj.side !== undefined || obj.sideLabel !== undefined
  const hasEntry = obj.entryPrice !== undefined || obj.entry !== undefined
  const hasStops = obj.stopLoss !== undefined || obj.stop !== undefined
  return hasMarket && hasDirection && hasEntry && hasStops
}

async function ensureIexecStakeForTask(iexec: IExec, requiredStake: bigint) {
  const address = await iexec.wallet.getAddress()
  let [walletBalances, accountBalance] = await Promise.all([
    iexec.wallet.checkBalances(address),
    iexec.account.checkBalance(address),
  ])

  let walletNrlc = toBigIntAmount(walletBalances.nRLC)
  let accountStake = toBigIntAmount(accountBalance.stake)
  let accountLocked = toBigIntAmount(accountBalance.locked)

  const toRlc = (nRlc: bigint) => {
    const decimals = 9n
    const divisor = 10n ** decimals
    const integerPart = nRlc / divisor
    const fractionPart = nRlc % divisor
    if (fractionPart === 0n) {
      return integerPart.toString()
    }
    return `${integerPart.toString()}.${fractionPart.toString().padStart(Number(decimals), '0').replace(/0+$/, '')}`
  }

  if (accountStake >= requiredStake) {
    return
  }

  const missingStake = requiredStake - accountStake
  if (walletNrlc < missingStake && accountLocked > 0n) {
    // Attempt to reclaim timed-out deals to free locked requester funds.
    try {
      const { deals } = await iexec.deal.fetchRequesterDeals(address, { page: 0, pageSize: 50 })
      for (const deal of deals) {
        const dealid = (deal as unknown as { dealid?: string; id?: string; dealId?: string }).dealid ||
          (deal as unknown as { dealid?: string; id?: string; dealId?: string }).id ||
          (deal as unknown as { dealid?: string; id?: string; dealId?: string }).dealId
        if (!dealid) {
          continue
        }
        try {
          const taskid = await iexec.deal.computeTaskId(dealid, 0)
          const task = await iexec.task.show(taskid)
          const status = (task as unknown as { statusName?: string; status?: string }).statusName ||
            (task as unknown as { statusName?: string; status?: string }).status
          if (status === 'TIMEOUT') {
            await iexec.deal.claim(dealid)
          }
        } catch {
          // best effort
        }
      }
    } catch {
      // best effort
    }

    ;[walletBalances, accountBalance] = await Promise.all([
      iexec.wallet.checkBalances(address),
      iexec.account.checkBalance(address),
    ])
    walletNrlc = toBigIntAmount(walletBalances.nRLC)
    accountStake = toBigIntAmount(accountBalance.stake)
    accountLocked = toBigIntAmount(accountBalance.locked)
    if (accountStake >= requiredStake) {
      return
    }
  }

  if (walletNrlc < missingStake) {
    throw new Error(
      [
        `Relay wallet nRLC too low for iExec stake top-up.`,
        `relay=${address}`,
        `need=${missingStake.toString()} nRLC (${toRlc(missingStake)} RLC)`,
        `wallet=${walletNrlc.toString()} nRLC (${toRlc(walletNrlc)} RLC)`,
        `stake=${accountStake.toString()} nRLC (${toRlc(accountStake)} RLC)`,
        `locked=${accountLocked.toString()} nRLC (${toRlc(accountLocked)} RLC)`,
      ].join(' ')
    )
  }

  await iexec.account.deposit(missingStake.toString())
}

export default class TeeController {
  public async syncStatus({ response }: HttpContextContract) {
    try {
      const service = getTeeSyncService()
      if (!service) {
        return {
          running: false,
          enabled: false,
          note: 'TEE sync service is disabled or not started',
        }
      }

      return {
        enabled: true,
        ...service.getStatus(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.status(500).send({ error: message })
    }
  }

  public async syncCatchup({ response }: HttpContextContract) {
    try {
      const service = (await ensureTeeSyncServiceStarted()) || getTeeSyncService()
      if (!service) {
        return response.badRequest({
          error: 'TEE sync service is disabled (set TEE_SYNC_ENABLED=true to enable)',
        })
      }

      const status = await service.catchUpNow()
      return {
        ok: true,
        status,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.status(500).send({ error: message })
    }
  }

  public async protect({ request, response }: HttpContextContract) {
    try {
      const dataProtector = getDataProtector()

      const body = request.only(['payload', 'name'])
      if (!body.payload || typeof body.payload !== 'object') {
        return response.badRequest({ error: 'Invalid payload body' })
      }

      const normalizedPayload = normalizeSignalPayload(body.payload as Record<string, unknown>)

      if (looksLikeSignalPayload(normalizedPayload)) {
        const validation = validateSignalPayload(normalizedPayload)
        if (!validation.valid) {
          return response.badRequest({
            error:
              'Invalid signal payload: missing/invalid required fields',
            missingStringFields: validation.missingStrings,
            invalidNumericFields: validation.invalidNumbers,
          })
        }
      }

      // Convert all numeric fields to strings before protectData to avoid
      // iExec number serialisation issues (deserializer fails on number type).
      const stringifiedPayload: Record<string, unknown> = { ...normalizedPayload }
      for (const field of SIGNAL_NUMERIC_FIELDS) {
        const value = stringifiedPayload[field]
        if (typeof value === 'number' && Number.isFinite(value)) {
          stringifiedPayload[field] = String(value)
        }
      }

      const protectedData = await protectDataWithRetry(
        dataProtector,
        stringifiedPayload,
        typeof body.name === 'string' ? body.name : 'Shingo Signal'
      )

      return {
        address: protectedData.address,
        txHash: protectedData.transactionHash,
      }
    } catch (error) {
      const rawMessage = toReadableError(error)
      const gasLikeError =
        /insufficient funds|intrinsic gas|fee per gas|max fee per gas|base fee/i.test(rawMessage)
      const message = gasLikeError
        ? `${rawMessage}. Relay wallet needs Arbitrum Sepolia ETH for protectData transaction gas.`
        : rawMessage
      return response.status(500).send({ error: message })
    }
  }

  public async grantSubscriber({ request, response }: HttpContextContract) {
    try {
      const body = request.only(['seasonId', 'subscriber'])
      const seasonId = parseSeasonId(body.seasonId)
      const subscriber = parseAddress(body.subscriber)

      if (!seasonId || !subscriber) {
        return response.badRequest({ error: 'Invalid seasonId or subscriber address' })
      }

      const hub = getHubContract()
      const isSubscribed = await isSubscribedFallback(hub, seasonId, subscriber)
      if (!isSubscribed) {
        return response.badRequest({ error: 'Wallet is not subscribed to this season' })
      }

      const signalIds = (await hub.getSeasonSignalIds(seasonId)) as bigint[]
      let granted = 0
      let alreadyGranted = 0

      for (const signalId of signalIds) {
        const signal = await hub.getSignal(signalId)
        const changed = await grantAccessSafely(signal.protectedDataAddr as string, subscriber)
        if (changed) {
          granted += 1
        } else {
          alreadyGranted += 1
        }
      }

      return {
        seasonId: seasonId.toString(),
        subscriber,
        signals: signalIds.length,
        granted,
        alreadyGranted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.status(500).send({ error: message })
    }
  }

  public async grantSeasonSubscribers({ request, response }: HttpContextContract) {
    try {
      const body = request.only(['seasonId', 'protectedDataAddr', 'signalId'])
      const providedSeasonId = parseSeasonId(body.seasonId)
      const providedProtectedDataAddr = parseAddress(body.protectedDataAddr)
      const signalId = parseSignalId(body.signalId)

      const hub = getHubContract()

      let seasonId = providedSeasonId
      let protectedDataAddr = providedProtectedDataAddr

      if (signalId) {
        const signal = await hub.getSignal(signalId)
        seasonId = BigInt(signal.seasonId)
        protectedDataAddr = parseAddress(signal.protectedDataAddr as string)
      }

      if (!seasonId || !protectedDataAddr) {
        return response.badRequest({
          error: 'Invalid input. Provide (seasonId + protectedDataAddr) or signalId',
        })
      }

      const subscribers = await getSeasonSubscribersFallback(hub, seasonId)
      let granted = 0
      let alreadyGranted = 0

      for (const subscriber of subscribers) {
        const changed = await grantAccessSafely(protectedDataAddr, subscriber)
        if (changed) {
          granted += 1
        } else {
          alreadyGranted += 1
        }
      }

      return {
        seasonId: seasonId.toString(),
        protectedDataAddr,
        signalId: signalId ? signalId.toString() : null,
        subscribers: subscribers.length,
        granted,
        alreadyGranted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.status(500).send({ error: message })
    }
  }

  public async publicizeSeason({ request, response }: HttpContextContract) {
    try {
      const body = request.only(['seasonId'])
      const seasonId = parseSeasonId(body.seasonId)

      if (!seasonId) {
        return response.badRequest({ error: 'Invalid seasonId' })
      }

      const hub = getHubContract()
      const signalIds = (await hub.getSeasonSignalIds(seasonId)) as bigint[]
      let granted = 0
      let alreadyGranted = 0

      for (const signalId of signalIds) {
        const signal = await hub.getSignal(signalId)
        const changed = await grantAccessSafely(signal.protectedDataAddr as string, ZeroAddress)
        if (changed) {
          granted += 1
        } else {
          alreadyGranted += 1
        }
      }

      return {
        seasonId: seasonId.toString(),
        signals: signalIds.length,
        granted,
        alreadyGranted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return response.status(500).send({ error: message })
    }
  }

  public async decrypt({ request, response }: HttpContextContract) {
    try {
      const body = request.only(['signalId', 'requester'])
      const signalId = parseSignalId(body.signalId)
      const requester = parseAddress(body.requester)

      if (!signalId || !requester) {
        return response.badRequest({ error: 'Invalid signalId or requester address' })
      }

      const hub = getHubContract()
      const signal = await hub.getSignal(signalId)

      let isPublic = false
      try {
        isPublic = (await hub.isSignalPublic(signalId)) as boolean
      } catch {
        isPublic = false
      }

      const seasonId = BigInt(signal.seasonId)
      const isSubscribed = isPublic
        ? true
        : await isSubscribedFallback(hub, seasonId, requester)

      if (!isSubscribed) {
        return response
          .status(403)
          .send({ error: 'Requester is not authorized to decrypt this signal' })
      }

      const dataProtector = getDataProtector()
      const preferredApp = getTeeAppAddress()
      const iexec = getIexec()
      const relayWalletAddress = await iexec.wallet.getAddress()
      const protectedDataAddr = signal.protectedDataAddr as string
      const selectedApp = preferredApp

      // Backend executes TEE jobs with relay wallet, so it must also be authorized.
      try {
        await grantAccessSafely(protectedDataAddr, relayWalletAddress, selectedApp)
      } catch {
        // Best effort; if already granted or temporarily unavailable, we still try.
      }

      try {
        await grantAccessSafely(protectedDataAddr, requester, selectedApp)
      } catch (error) {
        throw new Error(
          `Failed to grant TEE access to requester ${requester} for app ${selectedApp}: ${toReadableError(error)}`
        )
      }

      try {
        await ensureAppOrderPublished(iexec, selectedApp)
      } catch {
        // Best effort; if this fails we'll still attempt to find existing orders.
      }

      let selectedTriplet = await findTriplet({
        iexec,
        protectedData: protectedDataAddr,
        app: selectedApp,
        requester: relayWalletAddress,
      })
      if (!selectedTriplet) {
        // Short retry to absorb fresh orderbook publication/indexation delay.
        await sleep(1000)
        selectedTriplet = await findTriplet({
          iexec,
          protectedData: protectedDataAddr,
          app: selectedApp,
          requester: relayWalletAddress,
        })
      }
      if (!selectedTriplet) {
        throw new Error(
          `No compatible iExec orderbook triplet found for configured app ${selectedApp}`
        )
      }

      const { datasetOrder, appOrder, workerpoolOrder } = selectedTriplet

      const dataMaxPrice = Number(datasetOrder.datasetprice.toString())
      const appMaxPrice = Number(appOrder.appprice.toString())
      const workerpoolMaxPrice = Number(workerpoolOrder.workerpoolprice.toString())
      const workerpool = workerpoolOrder.workerpool.toString()
      const expectedCost = BigInt(dataMaxPrice + appMaxPrice + workerpoolMaxPrice)

      await ensureIexecStakeForTask(iexec, expectedCost)

      const processed = await dataProtector.core.processProtectedData({
        protectedData: protectedDataAddr,
        app: selectedApp,
        workerpool,
        dataMaxPrice,
        appMaxPrice,
        workerpoolMaxPrice,
      })

      const payload = await decodeArrayBufferResult(processed.result)
      let selectedAppName: string | null = null
      try {
        const appDetails = await iexec.app.showApp(selectedApp)
        selectedAppName = appDetails.app.appName || null
      } catch {
        selectedAppName = null
      }

      const payloadWarning = isLikelySignalPayload(payload)
        ? null
        : `TEE app output does not match Shingo signal schema. Current app: ${selectedAppName || 'unknown'} (${selectedApp}).`

      return {
        signalId: signalId.toString(),
        seasonId: seasonId.toString(),
        protectedDataAddr: signal.protectedDataAddr,
        selectedApp,
        selectedAppName,
        payloadWarning,
        payload,
      }
    } catch (error) {
      const message = toReadableError(error)
      return response.status(500).send({ error: message })
    }
  }
}
