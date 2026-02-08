"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_PARAMS,
  TARGET_CHAIN_ID,
} from "@/lib/evm/config";

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToTargetNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function normalizeHexChainId(chainIdHex: string) {
  return Number.parseInt(chainIdHex, 16);
}

export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const hasProvider = typeof window !== "undefined" && Boolean(window.ethereum);
  const isConnected = Boolean(address);
  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;

  const syncWalletState = useCallback(async () => {
    if (!window.ethereum) {
      setAddress(null);
      setChainId(null);
      return;
    }

    const [accounts, currentChain] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ]);

    const accountList = (accounts as string[]) ?? [];
    const chain = String(currentChain ?? "0x0");
    setAddress(accountList[0] ?? null);
    setChainId(normalizeHexChainId(chain));
  }, []);

  const switchToTargetNetwork = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No EVM wallet found");
    }
    const targetHex = `0x${TARGET_CHAIN_ID.toString(16)}`;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });
      setChainId(TARGET_CHAIN_ID);
    } catch (error: any) {
      const code = Number(error?.code);
      const needsAddChain = code === 4902 && TARGET_CHAIN_ID === ARBITRUM_SEPOLIA_CHAIN_ID;
      if (!needsAddChain) {
        throw error;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ARBITRUM_SEPOLIA_PARAMS],
      });
      setChainId(TARGET_CHAIN_ID);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("No EVM wallet found. Install MetaMask or Rabby.");
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAddress(accounts[0] ?? null);

      const currentChainHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const currentChain = normalizeHexChainId(currentChainHex);
      setChainId(currentChain);

      if (currentChain !== TARGET_CHAIN_ID) {
        await switchToTargetNetwork();
      }
    } finally {
      setIsConnecting(false);
    }
  }, [switchToTargetNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  useEffect(() => {
    syncWalletState().catch(() => {
      setAddress(null);
      setChainId(null);
    });
  }, [syncWalletState]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const next = (accounts as string[]) ?? [];
      setAddress(next[0] ?? null);
    };

    const handleChainChanged = (nextChainIdHex: unknown) => {
      setChainId(normalizeHexChainId(String(nextChainIdHex)));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      isConnected,
      isCorrectNetwork,
      isConnecting,
      hasProvider,
      connect,
      disconnect,
      switchToTargetNetwork,
    }),
    [
      address,
      chainId,
      isConnected,
      isCorrectNetwork,
      isConnecting,
      hasProvider,
      connect,
      disconnect,
      switchToTargetNetwork,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useEvmWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useEvmWallet must be used inside EvmWalletProvider");
  }
  return ctx;
}
