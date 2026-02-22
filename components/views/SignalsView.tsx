"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Views } from "@/types";
import { Copy, Eye, Lock } from "lucide-react";
import { HyperliquidTradeSheet } from "@/components/ui/hyperliquid-trade-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { shortenAddress } from "@/lib/utils";
import { LOG_LOOKBACK_BLOCKS, SHINGO_DEPLOY_BLOCK, SHINGO_HUB_ADDRESS } from "@/lib/evm/config";
import { SeasonView, SignalView, getPublicProvider, getReadHubContract } from "@/lib/evm/contracts";
import { useEvmWallet } from "@/lib/evm/wallet";

type SignalRow = {
  id: bigint;
  seasonId: bigint;
  trader: string;
  protectedDataAddr: string;
  publishedAt: bigint;
  seasonStatus: number;
};

function toSeasonView(raw: any): SeasonView {
  return {
    id: BigInt(raw.id),
    trader: raw.trader,
    priceToken: BigInt(raw.priceToken),
    collectionId: raw.collectionId,
    status: Number(raw.status),
    openedAt: BigInt(raw.openedAt),
    closedAt: BigInt(raw.closedAt),
    signalCount: BigInt(raw.signalCount),
  };
}

function toSignalView(raw: any): SignalView {
  return {
    id: BigInt(raw.id),
    seasonId: BigInt(raw.seasonId),
    trader: raw.trader,
    protectedDataAddr: raw.protectedDataAddr,
    publishedAt: BigInt(raw.publishedAt),
  };
}

export const SignalsView: React.FC<{
  onNavigate: (view: Views) => void;
  isConnected: boolean;
}> = ({ onNavigate, isConnected }) => {
  type DecryptResult = {
    payload: unknown;
    payloadWarning?: string | null;
    selectedApp?: string;
    selectedAppName?: string | null;
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3333";
  const { address } = useEvmWallet();
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [seasonIds, setSeasonIds] = useState<bigint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});
  const [decryptedResults, setDecryptedResults] = useState<Record<string, DecryptResult>>({});

  function signalKey(signal: SignalRow) {
    return `${signal.seasonId.toString()}-${signal.id.toString()}`;
  }

  async function decryptSignal(signal: SignalRow) {
    if (!address) {
      setError("Connect wallet first");
      return;
    }
    const key = signalKey(signal);
    setDecrypting((prev) => ({ ...prev, [key]: true }));
    setDecryptErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      const resp = await fetch(`${backendUrl}/tee/decrypt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalId: signal.id.toString(),
          requester: address,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error ?? "Unable to decrypt signal");
      }
      setDecryptedResults((prev) => ({
        ...prev,
        [key]: {
          payload: data?.payload ?? null,
          payloadWarning: data?.payloadWarning ?? null,
          selectedApp: data?.selectedApp,
          selectedAppName: data?.selectedAppName ?? null,
        },
      }));
    } catch (e: any) {
      const message = e?.shortMessage ?? e?.message ?? "Unable to decrypt signal";
      setDecryptErrors((prev) => ({ ...prev, [key]: message }));
    } finally {
      setDecrypting((prev) => ({ ...prev, [key]: false }));
    }
  }

  function renderDecryptedPayload(payload: unknown) {
    if (!payload) {
      return <p className="text-xs text-gray-500 dark:text-slate-400">No payload</p>;
    }

    if (typeof payload === "string") {
      return <p className="break-all font-mono text-xs text-gray-800 dark:text-slate-200">{payload}</p>;
    }

    if (typeof payload !== "object") {
      return <p className="break-all font-mono text-xs text-gray-800 dark:text-slate-200">{String(payload)}</p>;
    }

    const data = payload as Record<string, unknown>;
    const rows = [
      { label: "Market", value: data.market },
      { label: "Side", value: data.sideLabel ?? data.side },
      { label: "Entry Type", value: data.entryKindLabel ?? data.entryKind },
      { label: "Entry", value: data.entryPrice ?? data.entry },
      { label: "Stop Loss", value: data.stopLoss ?? data.stop },
      { label: "Take Profit", value: data.takeProfitPrice ?? data.takeProfit },
      { label: "TP Size (%)", value: data.takeProfitSize },
      { label: "Size USD", value: data.sizeUsd },
      { label: "Leverage", value: data.leverage },
      { label: "Venue", value: data.venueLabel ?? data.venue },
      { label: "Timeframe", value: data.timeframeLabel ?? data.timeframe },
    ].filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== "");

    return (
      <div className="space-y-3">
        {rows.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/80"
              >
                <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-500">{row.label}</p>
                <p className="break-all font-mono text-xs font-semibold text-gray-900 dark:text-slate-100">{String(row.value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-slate-400">No mapped fields found. Raw payload below.</p>
        )}
        <details className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/70">
          <summary className="cursor-pointer text-xs text-gray-600 dark:text-slate-300">Raw decrypted payload (JSON)</summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-gray-800 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-100">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  async function fetchSignals() {
    if (!address || !SHINGO_HUB_ADDRESS) return;

    setLoading(true);
    setError(null);
    setCopied(null);
    try {
      const provider = getPublicProvider();
      const hub = getReadHubContract();
      const latestBlock = await provider.getBlockNumber();
      const fromBlock =
        SHINGO_DEPLOY_BLOCK > 0
          ? SHINGO_DEPLOY_BLOCK
          : Math.max(0, latestBlock - LOG_LOOKBACK_BLOCKS);
      const logs = await hub.queryFilter(
        hub.filters.Subscribed(address),
        fromBlock,
        latestBlock
      );
      const uniqueSeasonIds = [...new Set(logs.map((log: any) => BigInt(log.args?.seasonId ?? 0n).toString()))]
        .map((value) => BigInt(value))
        .filter((id) => id > 0n);
      setSeasonIds(uniqueSeasonIds);

      const loadedSignals: SignalRow[] = [];
      for (const seasonId of uniqueSeasonIds) {
        const season = toSeasonView(await hub.getSeason(seasonId));
        const seasonSignals = (await hub.getSeasonSignals(seasonId, 0, 200)) as any[];
        for (const signalRaw of seasonSignals) {
          const signal = toSignalView(signalRaw);
          loadedSignals.push({
            id: signal.id,
            seasonId: signal.seasonId,
            trader: signal.trader,
            protectedDataAddr: signal.protectedDataAddr,
            publishedAt: signal.publishedAt,
            seasonStatus: season.status,
          });
        }
      }

      loadedSignals.sort((a, b) => Number(b.publishedAt - a.publishedAt));
      setSignals(loadedSignals);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Failed to fetch subscribed signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      fetchSignals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const openSignals = useMemo(() => signals.filter((s) => s.seasonStatus === 0), [signals]);
  const publicSignals = useMemo(() => signals.filter((s) => s.seasonStatus !== 0), [signals]);

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      {!isConnected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm dark:bg-slate-950/70">
          <Card className="mx-4 w-full max-w-md border-rose-300/30 bg-rose-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-rose-700 dark:text-rose-100">
                <Lock className="h-4 w-4" />
                Subscriber terminal
              </CardTitle>
              <CardDescription className="text-rose-600 dark:text-rose-100/80">
                Connect your wallet to load subscribed seasons and signals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-red-600 text-white hover:bg-red-500"
                onClick={() => onNavigate(Views.CONNECT_WALLET)}
              >
                Connect wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={!isConnected ? "pointer-events-none blur-sm" : ""}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold text-gray-950 dark:text-white">Signals Terminal</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              On-chain feed from seasons you subscribed to.
            </p>
          </div>
          <Button
            onClick={fetchSignals}
            disabled={loading || !address}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            {loading ? "Syncing..." : "Sync on-chain"}
          </Button>
        </div>

        <Card className="mb-6 border-slate-200 bg-white/70 dark:border-white/10 dark:bg-slate-950/60">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-xs">
            <Badge className="border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200">
              Subscribed seasons: {seasonIds.length}
            </Badge>
            <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
              Open signals: {openSignals.length}
            </Badge>
            <Badge className="border-amber-300/30 bg-amber-400/10 text-amber-700 dark:text-amber-100">
              Public signals: {publicSignals.length}
            </Badge>
            {SHINGO_HUB_ADDRESS && (
              <span className="max-w-full break-all font-mono text-gray-500 dark:text-slate-500" title={SHINGO_HUB_ADDRESS}>
                hub: {shortenAddress(SHINGO_HUB_ADDRESS, 10, 8)}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-violet-300/25 bg-violet-500/10">
          <CardContent className="p-4 text-sm text-violet-700 dark:text-violet-100">
            Signal payload decryption is handled by the iExec TEE flow using `protectedDataAddr`.
            This screen confirms on-chain subscription access and exposes dataset addresses.
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-rose-300/30 bg-rose-500/10">
            <CardContent className="p-4 text-sm text-rose-700 dark:text-rose-100">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {signals.map((signal) => (
            <Card key={`${signal.seasonId.toString()}-${signal.id.toString()}`} className="glass-panel">
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="font-display text-lg text-gray-950 dark:text-white">
                  Signal #{signal.id.toString()}
                </CardTitle>
                <CardDescription className="break-all font-mono text-xs text-gray-500 dark:text-slate-400">
                  trader: {shortenAddress(signal.trader, 8, 6)} | season: #{signal.seasonId.toString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/80">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-500">protectedDataAddr</p>
                  <p className="break-all font-mono text-xs text-gray-800 dark:text-slate-200">{signal.protectedDataAddr}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-200">
                    {signal.seasonStatus === 0 ? "Subscriber-only (season OPEN)" : "Public (season CLOSED)"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 text-gray-600 dark:border-white/15 dark:text-slate-300">
                    timestamp: {signal.publishedAt.toString()}
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-slate-300 bg-white dark:border-white/15 dark:bg-slate-950/70"
                  onClick={async () => {
                    await navigator.clipboard.writeText(signal.protectedDataAddr);
                    setCopied(signal.protectedDataAddr);
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {copied === signal.protectedDataAddr ? "Copied" : "Copy protectedDataAddr"}
                </Button>

                <Button
                  className="w-full bg-red-600 text-white hover:bg-red-500"
                  disabled={decrypting[signalKey(signal)]}
                  onClick={() => decryptSignal(signal)}
                >
                  <Eye className="h-4 w-4" />
                  {decrypting[signalKey(signal)] ? "Decrypting..." : "Decrypt signal"}
                </Button>

                {decryptErrors[signalKey(signal)] && (
                  <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-100">
                    {decryptErrors[signalKey(signal)]}
                  </div>
                )}

                {decryptedResults[signalKey(signal)] !== undefined && (
                  <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                      Decrypted Signal
                    </p>
                    {decryptedResults[signalKey(signal)]?.selectedApp && (
                      <p className="mb-2 break-all text-[11px] text-emerald-800 dark:text-emerald-100/90">
                        app:{" "}
                        {decryptedResults[signalKey(signal)]?.selectedAppName
                          ? `${decryptedResults[signalKey(signal)]?.selectedAppName} `
                          : ""}
                        <span className="font-mono">{decryptedResults[signalKey(signal)]?.selectedApp}</span>
                      </p>
                    )}
                    {decryptedResults[signalKey(signal)]?.payloadWarning && (
                      <div className="mb-3 rounded-md border border-amber-300/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-100">
                        {decryptedResults[signalKey(signal)]?.payloadWarning}
                      </div>
                    )}
                    {renderDecryptedPayload(decryptedResults[signalKey(signal)]?.payload)}
                  </div>
                )}

                {decryptedResults[signalKey(signal)]?.payload != null &&
                  typeof decryptedResults[signalKey(signal)]?.payload === "object" ? (
                  <HyperliquidTradeSheet
                    payload={decryptedResults[signalKey(signal)]!.payload as Record<string, unknown>}
                    signalId={signal.id.toString()}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}

          {signals.length === 0 && !loading && (
            <Card className="border-slate-200 bg-white/70 md:col-span-2 dark:border-white/10 dark:bg-slate-950/60">
              <CardContent className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
                No signal found for your wallet subscriptions.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
