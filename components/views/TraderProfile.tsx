"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Views } from "@/types";
import { ArrowLeft, ExternalLink, Share2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WalletAvatar } from "@/components/ui/wallet-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { shortenAddress } from "@/lib/utils";
import {
  LOG_LOOKBACK_BLOCKS,
  PAYMENT_TOKEN_DECIMALS,
  PAYMENT_TOKEN_SYMBOL,
  SHINGO_DEPLOY_BLOCK,
  SHINGO_HUB_ADDRESS,
} from "@/lib/evm/config";
import {
  SeasonView,
  SignalView,
  TraderView,
  formatToken,
  getSeasonSubscribersSafe,
  getPublicProvider,
  getReadHubContract,
  getWriteFeeOverrides,
  getWriteHubContract,
  getWriteTokenContract,
} from "@/lib/evm/contracts";
import { useEvmWallet } from "@/lib/evm/wallet";

type TraderData = {
  pseudo: string;
  wallet: string;
  currentSeasonId: bigint;
  registeredAt: bigint;
};

type SeasonData = {
  id: bigint;
  status: number;
  priceToken: bigint;
  signalCount: bigint;
  subscribers: number;
};

type PublicHistoryRow = {
  seasonId: bigint;
  signalId: bigint;
  protectedDataAddr: string;
  publishedAt: bigint;
  isPublic: boolean;
};

type DecryptResult = {
  payload: unknown;
  payloadWarning?: string | null;
  selectedApp?: string;
  selectedAppName?: string | null;
};

function toTraderView(raw: any): TraderView {
  return {
    pseudo: raw.pseudo,
    wallet: raw.wallet,
    currentSeasonId: BigInt(raw.currentSeasonId),
    active: Boolean(raw.active),
    registeredAt: BigInt(raw.registeredAt),
  };
}

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

export const TraderProfile: React.FC<{
  onNavigate: (view: Views) => void;
  traderId: string | null;
  traderAddr: string | null;
}> = ({ onNavigate, traderId, traderAddr }) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3333";
  const { address, isConnected, isCorrectNetwork, switchToTargetNetwork } = useEvmWallet();
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSuccess, setSubSuccess] = useState<string | null>(null);
  const [trader, setTrader] = useState<TraderData | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [publicHistory, setPublicHistory] = useState<PublicHistoryRow[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
  const [decryptErrors, setDecryptErrors] = useState<Record<string, string>>({});
  const [decryptedResults, setDecryptedResults] = useState<Record<string, DecryptResult>>({});

  const wallet = traderAddr ?? traderId;

  useEffect(() => {
    async function loadProfile() {
      if (!wallet || !SHINGO_HUB_ADDRESS) return;
      setLoading(true);
      setSubError(null);
      setHistoryError(null);
      try {
        const hub = getReadHubContract();
        const traderRaw = toTraderView(await hub.getTrader(wallet));
        setTrader({
          pseudo: traderRaw.pseudo,
          wallet: traderRaw.wallet,
          currentSeasonId: traderRaw.currentSeasonId,
          registeredAt: traderRaw.registeredAt,
        });

        if (traderRaw.currentSeasonId > 0n) {
          const seasonRaw = toSeasonView(await hub.getSeason(traderRaw.currentSeasonId));
          const subscribers = await getSeasonSubscribersSafe(hub, traderRaw.currentSeasonId);
          setSeason({
            id: seasonRaw.id,
            status: seasonRaw.status,
            priceToken: seasonRaw.priceToken,
            signalCount: seasonRaw.signalCount,
            subscribers: subscribers.length,
          });
        } else {
          setSeason(null);
        }

        let seasonIds: bigint[] = [];
        try {
          seasonIds = ((await hub.getTraderSeasonIds(wallet)) as bigint[]).filter((id) => id > 0n);
        } catch {
          const provider = getPublicProvider();
          const latestBlock = await provider.getBlockNumber();
          const fromBlock =
            SHINGO_DEPLOY_BLOCK > 0
              ? SHINGO_DEPLOY_BLOCK
              : Math.max(0, latestBlock - LOG_LOOKBACK_BLOCKS);
          const closedLogs = await hub.queryFilter(
            hub.filters.SeasonClosed(wallet),
            fromBlock,
            latestBlock
          );
          seasonIds = [...new Set(closedLogs.map((log: any) => BigInt(log.args?.seasonId ?? 0n).toString()))]
            .map((id) => BigInt(id))
            .filter((id) => id > 0n);
        }

        if (seasonIds.length === 0) {
          setPublicHistory([]);
          return;
        }

        const seasonDetails = await Promise.all(
          seasonIds.map(async (seasonId) => ({
            seasonId,
            season: toSeasonView(await hub.getSeason(seasonId)),
          }))
        );
        const closedSeasonIds = seasonDetails
          .filter(({ season }) => season.status !== 0)
          .map(({ seasonId }) => seasonId);

        if (closedSeasonIds.length === 0) {
          setPublicHistory([]);
          return;
        }

        const historyRows: PublicHistoryRow[] = [];
        for (const seasonId of closedSeasonIds) {
          const seasonSignals = (await hub.getSeasonSignals(seasonId, 0, 200)) as any[];
          for (const rawSignal of seasonSignals) {
            const signal = toSignalView(rawSignal);
            historyRows.push({
              seasonId: signal.seasonId,
              signalId: signal.id,
              protectedDataAddr: signal.protectedDataAddr,
              publishedAt: signal.publishedAt,
              isPublic: true,
            });
          }
        }

        historyRows.sort((a, b) => Number(b.publishedAt - a.publishedAt));
        setPublicHistory(historyRows);
      } catch (e: any) {
        setSubError(e?.shortMessage ?? e?.message ?? "Unable to load trader profile");
        setPublicHistory([]);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [wallet, subSuccess]);

  const priceDisplay = useMemo(() => {
    if (!season) return `0 ${PAYMENT_TOKEN_SYMBOL}`;
    return `${Number(formatToken(season.priceToken)).toFixed(2)} ${PAYMENT_TOKEN_SYMBOL}`;
  }, [season]);

  function historyKey(row: PublicHistoryRow) {
    return `${row.seasonId.toString()}-${row.signalId.toString()}`;
  }

  function formatTimestamp(seconds: bigint) {
    const timestamp = Number(seconds);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return "n/a";
    }
    return new Date(timestamp * 1000).toLocaleString();
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
      <div className="space-y-2">
        {rows.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-900/80">
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

  async function decryptPublicSignal(row: PublicHistoryRow) {
    const key = historyKey(row);
    const requester = address ?? "0x0000000000000000000000000000000000000000";

    setDecrypting((prev) => ({ ...prev, [key]: true }));
    setDecryptErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      const resp = await fetchWithRetry(
        `${backendUrl}/tee/decrypt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signalId: row.signalId.toString(),
            requester,
          }),
        },
        2,
        500
      );
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
      setDecryptErrors((prev) => ({
        ...prev,
        [key]: e?.shortMessage ?? e?.message ?? "Unable to decrypt signal",
      }));
    } finally {
      setDecrypting((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 2,
    delayMs = 700
  ) {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        return await fetch(url, init);
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Network request failed");
  }

  async function subscribe() {
    if (!isConnected || !address) {
      setSubError("Connect your wallet first");
      return;
    }
    if (!isCorrectNetwork) {
      setSubError("Switch to Arbitrum network first");
      return;
    }
    if (!season || season.status !== 0) {
      setSubError("No open season available for this trader");
      return;
    }
    if (!SHINGO_HUB_ADDRESS) {
      setSubError("Missing NEXT_PUBLIC_SHINGO_HUB_ADDRESS");
      return;
    }

    setSubscribing(true);
    setSubError(null);
    setSubSuccess(null);

    try {
      await switchToTargetNetwork();
      const hub = await getWriteHubContract();
      const token = await getWriteTokenContract();

      const allowance = (await token.allowance(address, SHINGO_HUB_ADDRESS)) as bigint;
      const feeOverrides = await getWriteFeeOverrides();
      if (allowance < season.priceToken) {
        const approveTx = await token.approve(
          SHINGO_HUB_ADDRESS,
          season.priceToken,
          feeOverrides
        );
        await approveTx.wait();
      }

      const tx = await hub.subscribe(season.id, feeOverrides);
      await tx.wait();
      try {
        const syncResp = await fetchWithRetry(
          `${backendUrl}/tee/grant-subscriber`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seasonId: season.id.toString(),
              subscriber: address,
            }),
          },
          2,
          500
        );
        if (!syncResp.ok) {
          setSubSuccess(
            `Subscription confirmed on-chain: ${tx.hash}. TEE access sync will be caught up by relay.`
          );
        } else {
          setSubSuccess(`Subscription confirmed: ${tx.hash}`);
        }
      } catch {
        setSubSuccess(
          `Subscription confirmed on-chain: ${tx.hash}. TEE access sync will be caught up by relay.`
        );
      }
    } catch (e: any) {
      const message = e?.shortMessage ?? e?.message ?? "Subscription failed";
      if (String(message).toLowerCase().includes("failed to fetch")) {
        setSubError(
          `TEE backend unreachable at ${backendUrl}. Wait a few seconds and retry (API may still be starting).`
        );
      } else {
        setSubError(message);
      }
    } finally {
      setSubscribing(false);
    }
  }

  const displayName =
    trader?.pseudo?.trim() && trader.pseudo !== trader.wallet
      ? trader.pseudo
      : shortenAddress(trader?.wallet ?? wallet ?? "", 10, 8);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="w-fit px-2 text-gray-600 dark:text-slate-300"
          onClick={() => onNavigate(Views.MARKETPLACE)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="glass-panel overflow-hidden">
          <div className="h-24 bg-mesh-gradient" />
          <CardContent className="space-y-6 p-6">
            <WalletAvatar
              address={trader?.wallet ?? wallet}
              size={96}
              className="-mt-14 border-4 border-white dark:border-slate-900"
            />

            <div className="space-y-2">
              <h1
                className="max-w-full break-all font-display text-2xl font-semibold text-gray-950 dark:text-white sm:text-3xl"
                title={displayName}
              >
                {displayName}
              </h1>
              <p className="max-w-full break-all font-mono text-xs text-gray-500 dark:text-slate-400">
                {trader?.wallet ? shortenAddress(trader.wallet, 10, 8) : "Unknown wallet"}
              </p>
              <Badge className="gap-1 border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                On-chain strategy profile
              </Badge>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Subscribe to the current season to access encrypted signals.
              </p>
            </div>

            <Separator />

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/70">
              <div className="flex items-end justify-between">
                <span className="text-sm text-gray-700 dark:text-slate-300">Current season price</span>
                <span className="font-mono text-2xl text-red-600 dark:text-red-300">{priceDisplay}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/80">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Season</p>
                  <p className="font-mono text-sm font-semibold text-gray-950 dark:text-white">
                    {season ? `#${season.id.toString()}` : "none"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/80">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Status</p>
                  <p className="font-mono text-sm font-semibold text-gray-950 dark:text-white">
                    {season?.status === 0 ? "OPEN" : "CLOSED"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/80">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Signals</p>
                  <p className="font-mono text-sm font-semibold text-gray-950 dark:text-white">{season?.signalCount.toString() ?? "0"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/80">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-500">Subscribers</p>
                  <p className="font-mono text-sm font-semibold text-gray-950 dark:text-white">{season?.subscribers ?? 0}</p>
                </div>
              </div>

              {loading && <Badge className="w-fit">Loading profile...</Badge>}
              {subError && <Badge variant="destructive">{subError}</Badge>}
              {subSuccess && (
                <Badge className="whitespace-normal break-all border-emerald-300/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-100">
                  {subSuccess}
                </Badge>
              )}

              <Button
                className="w-full bg-red-600 text-white hover:bg-red-500"
                onClick={subscribe}
                disabled={subscribing || !isConnected || !season || season.status !== 0}
              >
                {subscribing ? "Subscribing..." : `Subscribe with ${PAYMENT_TOKEN_SYMBOL}`}
              </Button>

              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Approval is done only if required. Amount uses {PAYMENT_TOKEN_DECIMALS} token decimals.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="border-slate-300 bg-white dark:border-white/15 dark:bg-slate-950/70">
                <ExternalLink className="h-4 w-4" />
                Arbiscan
              </Button>
              <Button variant="outline" className="border-slate-300 bg-white dark:border-white/15 dark:bg-slate-950/70">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="font-display text-xl text-gray-950 dark:text-white">Public history</CardTitle>
              <CardDescription>
                Real on-chain signals from closed seasons. Public signals can be decrypted without a connected wallet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyError && <Badge variant="destructive">{historyError}</Badge>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Season</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>protectedDataAddr</TableHead>
                    <TableHead>Decrypt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicHistory.map((row) => {
                    const key = historyKey(row);
                    return (
                      <React.Fragment key={key}>
                        <TableRow>
                          <TableCell className="font-mono text-xs text-gray-700 dark:text-slate-300">#{row.seasonId.toString()}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-700 dark:text-slate-300">#{row.signalId.toString()}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-700 dark:text-slate-300">{formatTimestamp(row.publishedAt)}</TableCell>
                          <TableCell className="max-w-[240px] break-all font-mono text-xs text-gray-700 dark:text-slate-300">
                            {row.protectedDataAddr}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-300 bg-white dark:border-white/15 dark:bg-slate-950/70"
                              onClick={() => decryptPublicSignal(row)}
                              disabled={decrypting[key]}
                            >
                              {decrypting[key] ? "Decrypting..." : "Decrypt"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {(decryptErrors[key] || decryptedResults[key]) && (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/60">
                                {decryptErrors[key] && (
                                  <Badge variant="destructive">{decryptErrors[key]}</Badge>
                                )}
                                {decryptedResults[key]?.selectedApp && (
                                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                    app: {decryptedResults[key]?.selectedAppName ? `${decryptedResults[key]?.selectedAppName} ` : ""}
                                    <span className="font-mono">{decryptedResults[key]?.selectedApp}</span>
                                  </p>
                                )}
                                {decryptedResults[key]?.payloadWarning && (
                                  <Badge variant="destructive">{decryptedResults[key]?.payloadWarning}</Badge>
                                )}
                                {decryptedResults[key] && renderDecryptedPayload(decryptedResults[key]?.payload)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {publicHistory.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-gray-500 dark:text-slate-400">
                        No public signals yet. Close a season to make its signals public here.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
