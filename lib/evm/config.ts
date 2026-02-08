export const ARBITRUM_ONE_CHAIN_ID = 42161;
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const DEFAULT_ARBITRUM_SEPOLIA_PUBLIC_RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const LOCAL_RPC_PROXY_PATH = "/api/rpc";
const RAW_CLIENT_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ??
  "";
const USE_LOCAL_RPC_PROXY =
  !RAW_CLIENT_RPC_URL ||
  /^https?:\/\/sepolia-rollup\.arbitrum\.io\/rpc\/?$/i.test(RAW_CLIENT_RPC_URL);

export const TARGET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? ARBITRUM_SEPOLIA_CHAIN_ID
);

export const TARGET_RPC_URL =
  USE_LOCAL_RPC_PROXY ? LOCAL_RPC_PROXY_PATH : RAW_CLIENT_RPC_URL;

export const SHINGO_HUB_ADDRESS =
  process.env.NEXT_PUBLIC_SHINGO_HUB_ADDRESS ?? "";

export const PAYMENT_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ?? "";

export const PAYMENT_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL ?? "USDC";

export const PAYMENT_TOKEN_DECIMALS = Number(
  process.env.NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS ?? 6
);

export const SHINGO_DEPLOY_BLOCK = Number(
  process.env.NEXT_PUBLIC_SHINGO_DEPLOY_BLOCK ?? 0
);

export const LOG_LOOKBACK_BLOCKS = Number(
  process.env.NEXT_PUBLIC_LOG_LOOKBACK_BLOCKS ?? 20000
);

export const ARBITRUM_SEPOLIA_PARAMS = {
  chainId: `0x${ARBITRUM_SEPOLIA_CHAIN_ID.toString(16)}`,
  chainName: "Arbitrum Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL ??
      DEFAULT_ARBITRUM_SEPOLIA_PUBLIC_RPC,
  ],
  blockExplorerUrls: ["https://sepolia.arbiscan.io"],
};
