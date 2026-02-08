import dotenv from 'dotenv';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { IExecTeeGateway } from './dataprotector';

dotenv.config({ path: '.env' });

const SHINGO_HUB_ABI = [
  'event Subscribed(address indexed subscriber, address indexed trader, uint256 indexed seasonId, uint256 amountToken)',
  'event SignalPublished(address indexed trader, uint256 indexed seasonId, uint256 indexed signalId, string protectedDataAddr)',
  'event SeasonClosed(address indexed trader, uint256 indexed seasonId)',
  'function getSeasonSignalIds(uint256 seasonId) view returns (uint256[])',
  'function getSeasonSubscribers(uint256 seasonId) view returns (address[])',
  'function getSignal(uint256 signalId) view returns (tuple(uint256 id,uint256 seasonId,address trader,string protectedDataAddr,uint256 publishedAt))'
];

export interface RelayConfig {
  arbitrumRpcUrl: string;
  shingoHubAddress: string;
  relayPrivateKey: string;
  iexecRpcUrl: string;
  iexecAppAddress: string;
}

export function loadRelayConfigFromEnv(): RelayConfig {
  const arbitrumRpcUrl = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const shingoHubAddress = process.env.SHINGO_HUB_ADDRESS;
  const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
  const iexecRpcUrl =
    process.env.IEXEC_RPC_URL ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    process.env.ARBITRUM_RPC_URL ||
    'https://sepolia-rollup.arbitrum.io/rpc';
  const iexecAppAddress = process.env.IEXEC_TEE_APP;

  if (!arbitrumRpcUrl || !shingoHubAddress || !relayPrivateKey || !iexecAppAddress) {
    throw new Error(
      'Missing relay env. Required: ARBITRUM_RPC_URL|ARBITRUM_SEPOLIA_RPC_URL, SHINGO_HUB_ADDRESS, RELAY_PRIVATE_KEY, IEXEC_TEE_APP'
    );
  }

  return {
    arbitrumRpcUrl,
    shingoHubAddress,
    relayPrivateKey,
    iexecRpcUrl,
    iexecAppAddress
  };
}

export class ShingoRelay {
  private readonly provider: JsonRpcProvider;
  private readonly hub: Contract;
  private readonly tee: IExecTeeGateway;
  private readonly processed = new Set<string>();

  constructor(config: RelayConfig) {
    this.provider = new JsonRpcProvider(config.arbitrumRpcUrl);

    const signer = new Wallet(config.relayPrivateKey, this.provider);
    this.hub = new Contract(config.shingoHubAddress, SHINGO_HUB_ABI, signer);

    this.tee = new IExecTeeGateway({
      rpcUrl: config.iexecRpcUrl,
      privateKey: config.relayPrivateKey,
      appAddress: config.iexecAppAddress
    });
  }

  start(): void {
    this.hub.on('Subscribed', async (subscriber: string, _trader: string, seasonId: bigint, _amountToken: bigint, event: { log: { transactionHash: string; index: number } }) => {
      const key = `${event.log.transactionHash}:${event.log.index}`;
      if (this.processed.has(key)) {
        return;
      }
      this.processed.add(key);

      await this.grantSeasonAccess(seasonId, subscriber);
    });

    this.hub.on('SeasonClosed', async (_trader: string, seasonId: bigint, event: { log: { transactionHash: string; index: number } }) => {
      const key = `${event.log.transactionHash}:${event.log.index}`;
      if (this.processed.has(key)) {
        return;
      }
      this.processed.add(key);

      await this.publicizeSeason(seasonId);
    });

    this.hub.on('SignalPublished', async (_trader: string, seasonId: bigint, signalId: bigint, _protectedDataAddr: string, event: { log: { transactionHash: string; index: number } }) => {
      const key = `${event.log.transactionHash}:${event.log.index}`;
      if (this.processed.has(key)) {
        return;
      }
      this.processed.add(key);

      await this.grantPublishedSignalToSeasonSubscribers(seasonId, signalId);
    });
  }

  async grantSeasonAccess(seasonId: bigint, subscriber: string): Promise<void> {
    const signalIds = (await this.hub.getSeasonSignalIds(seasonId)) as bigint[];
    for (const signalId of signalIds) {
      const signal = await this.hub.getSignal(signalId);
      await this.tee.grantSubscriberAccess(signal.protectedDataAddr, subscriber);
    }
  }

  async publicizeSeason(seasonId: bigint): Promise<void> {
    const signalIds = (await this.hub.getSeasonSignalIds(seasonId)) as bigint[];
    for (const signalId of signalIds) {
      const signal = await this.hub.getSignal(signalId);
      await this.tee.publicizeSignal(signal.protectedDataAddr);
    }
  }

  async grantPublishedSignalToSeasonSubscribers(seasonId: bigint, signalId: bigint): Promise<void> {
    const subscribers = (await this.hub.getSeasonSubscribers(seasonId)) as string[];
    if (subscribers.length === 0) {
      return;
    }

    const signal = await this.hub.getSignal(signalId);
    for (const subscriber of subscribers) {
      await this.tee.grantSubscriberAccess(signal.protectedDataAddr, subscriber);
    }
  }
}

if (require.main === module) {
  const relay = new ShingoRelay(loadRelayConfigFromEnv());
  relay.start();
  // eslint-disable-next-line no-console
  console.log('Shingo relay started');
}
