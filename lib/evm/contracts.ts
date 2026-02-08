import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatUnits,
} from "ethers";
import {
  LOG_LOOKBACK_BLOCKS,
  PAYMENT_TOKEN_ADDRESS,
  PAYMENT_TOKEN_DECIMALS,
  SHINGO_DEPLOY_BLOCK,
  SHINGO_HUB_ADDRESS,
  TARGET_CHAIN_ID,
  TARGET_RPC_URL,
} from "@/lib/evm/config";

export const SHINGO_HUB_ABI = [
  "function paymentToken() view returns (address)",
  "function registerTrader(string pseudo)",
  "function updatePseudo(string newPseudo)",
  "function openSeason(uint256 priceToken) returns (uint256)",
  "function closeSeason()",
  "function publishSignal(string protectedDataAddr) returns (uint256)",
  "function subscribe(uint256 seasonId)",
  "function isSubscribed(address subscriber, uint256 seasonId) view returns (bool)",
  "function isSignalPublic(uint256 signalId) view returns (bool)",
  "function getTrader(address traderAddr) view returns ((string pseudo,address wallet,uint256 currentSeasonId,bool active,uint256 registeredAt))",
  "function getSeason(uint256 seasonId) view returns ((uint256 id,address trader,uint256 priceToken,string collectionId,uint8 status,uint256 openedAt,uint256 closedAt,uint256 signalCount))",
  "function getSignal(uint256 signalId) view returns ((uint256 id,uint256 seasonId,address trader,string protectedDataAddr,uint256 publishedAt))",
  "function getSeasonSignalIds(uint256 seasonId) view returns (uint256[])",
  "function getSeasonSignals(uint256 seasonId, uint256 offset, uint256 limit) view returns ((uint256 id,uint256 seasonId,address trader,string protectedDataAddr,uint256 publishedAt)[])",
  "function getSeasonSubscribers(uint256 seasonId) view returns (address[])",
  "function getTraderSeasonIds(address traderAddr) view returns (uint256[])",
  "function getSubscription(address subscriber, uint256 seasonId) view returns ((address subscriber,uint256 seasonId,uint256 paidAt,uint256 amountToken))",
  "event TraderRegistered(address indexed trader, string pseudo)",
  "event PseudoUpdated(address indexed trader, string newPseudo)",
  "event SeasonOpened(address indexed trader, uint256 indexed seasonId, uint256 priceToken)",
  "event SeasonClosed(address indexed trader, uint256 indexed seasonId)",
  "event SignalPublished(address indexed trader, uint256 indexed seasonId, uint256 indexed signalId, string protectedDataAddr)",
  "event Subscribed(address indexed subscriber, address indexed trader, uint256 indexed seasonId, uint256 amountToken)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export type TraderView = {
  pseudo: string;
  wallet: string;
  currentSeasonId: bigint;
  active: boolean;
  registeredAt: bigint;
};

export type SeasonView = {
  id: bigint;
  trader: string;
  priceToken: bigint;
  collectionId: string;
  status: number;
  openedAt: bigint;
  closedAt: bigint;
  signalCount: bigint;
};

export type SignalView = {
  id: bigint;
  seasonId: bigint;
  trader: string;
  protectedDataAddr: string;
  publishedAt: bigint;
};

let publicProvider: JsonRpcProvider | null = null;

function resolveRpcUrl() {
  if (!TARGET_RPC_URL.startsWith("/")) {
    return TARGET_RPC_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${TARGET_RPC_URL}`;
  }

  // Fallback for non-browser execution paths.
  return `http://127.0.0.1:3000${TARGET_RPC_URL}`;
}

function resolveNetworkName() {
  if (TARGET_CHAIN_ID === 421614) {
    return "arbitrum-sepolia";
  }
  if (TARGET_CHAIN_ID === 42161) {
    return "arbitrum";
  }
  return "evm";
}

export function getPublicProvider() {
  if (!publicProvider) {
    publicProvider = new JsonRpcProvider(
      resolveRpcUrl(),
      {
        chainId: TARGET_CHAIN_ID,
        name: resolveNetworkName(),
      },
      {
        staticNetwork: true,
        pollingInterval: 15_000,
      }
    );
  }
  return publicProvider;
}

export function getBrowserProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }
  return new BrowserProvider(window.ethereum);
}

export function getReadHubContract() {
  if (!SHINGO_HUB_ADDRESS) {
    throw new Error("NEXT_PUBLIC_SHINGO_HUB_ADDRESS is missing");
  }
  return new Contract(SHINGO_HUB_ADDRESS, SHINGO_HUB_ABI, getPublicProvider());
}

export async function getWriteHubContract() {
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("EVM wallet not found");
  }
  if (!SHINGO_HUB_ADDRESS) {
    throw new Error("NEXT_PUBLIC_SHINGO_HUB_ADDRESS is missing");
  }
  const signer = await provider.getSigner();
  return new Contract(SHINGO_HUB_ADDRESS, SHINGO_HUB_ABI, signer);
}

export async function getWriteTokenContract() {
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("EVM wallet not found");
  }
  const signer = await provider.getSigner();
  const address = PAYMENT_TOKEN_ADDRESS || (await getReadHubContract().paymentToken());
  return new Contract(address, ERC20_ABI, signer);
}

export function formatToken(amount: bigint, decimals = PAYMENT_TOKEN_DECIMALS) {
  return formatUnits(amount, decimals);
}

export async function getSeasonSubscribersSafe(
  hub: Contract,
  seasonId: bigint
): Promise<string[]> {
  try {
    return (await hub.getSeasonSubscribers(seasonId)) as string[];
  } catch {
    const provider = getPublicProvider();
    const latestBlock = await provider.getBlockNumber();
    const fromBlock =
      SHINGO_DEPLOY_BLOCK > 0
        ? SHINGO_DEPLOY_BLOCK
        : Math.max(0, latestBlock - LOG_LOOKBACK_BLOCKS);
    const logs = await hub.queryFilter(
      hub.filters.Subscribed(null, null, seasonId),
      fromBlock,
      latestBlock
    );
    const unique = new Set<string>();
    for (const log of logs as any[]) {
      const subscriber = String(log.args?.subscriber ?? "").trim();
      if (subscriber) {
        unique.add(subscriber.toLowerCase());
      }
    }
    return Array.from(unique);
  }
}

export async function getWriteFeeOverrides() {
  const provider = getBrowserProvider();
  if (!provider) {
    return {};
  }

  let gasPrice = 20_000_000n;
  let baseFee = 0n;
  const maxPriorityFeePerGas = 1_000_000n; // 0.001 gwei

  try {
    const block = (await provider.send("eth_getBlockByNumber", [
      "latest",
      false,
    ])) as { baseFeePerGas?: string } | null;
    if (block?.baseFeePerGas) {
      baseFee = BigInt(block.baseFeePerGas);
    }
  } catch {
    // no-op
  }

  try {
    const gasPriceHex = (await provider.send("eth_gasPrice", [])) as
      | string
      | null;
    if (gasPriceHex) {
      gasPrice = BigInt(gasPriceHex);
    }
  } catch {
    // no-op
  }

  let maxFeePerGas = baseFee > 0n ? baseFee * 2n + maxPriorityFeePerGas : gasPrice * 2n;
  if (maxFeePerGas <= gasPrice) {
    maxFeePerGas = gasPrice + maxPriorityFeePerGas;
  }
  if (maxFeePerGas <= 0n) {
    maxFeePerGas = 50_000_000n;
  }

  return {
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (eventName: string, listener: (...args: unknown[]) => void) => void;
      removeListener: (eventName: string, listener: (...args: unknown[]) => void) => void;
      selectedAddress?: string;
    };
  }
}
