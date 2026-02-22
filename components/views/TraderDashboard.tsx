"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Views } from "@/types";
import { ExternalLink, Lock, UploadCloud } from "lucide-react";
import { parseUnits } from "ethers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortenAddress } from "@/lib/utils";
import {
  PAYMENT_TOKEN_DECIMALS,
  PAYMENT_TOKEN_SYMBOL,
  SHINGO_HUB_ADDRESS,
} from "@/lib/evm/config";
import {
  SeasonView,
  TraderView,
  formatToken,
  getWriteFeeOverrides,
  getReadHubContract,
  getWriteHubContract,
} from "@/lib/evm/contracts";
import { useEvmWallet } from "@/lib/evm/wallet";

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

const MARKETS = [
  { label: "BTC/USD", left: "BTC", right: "USD" },
  { label: "ETH/USD", left: "ETH", right: "USD" },
  { label: "SOL/USD", left: "SOL", right: "USD" },
] as const;

const SIDES = [
  { label: "Long", value: "0" },
  { label: "Short", value: "1" },
] as const;

const ENTRY_KINDS = [
  { label: "Market", value: "0" },
  { label: "Limit", value: "1" },
] as const;

const VENUES = [
  { label: "Hyperliquid", value: "0" },
  { label: "Drift", value: "1" },
  { label: "Flash Trade", value: "2" },
  { label: "Jupiter", value: "3" },
  { label: "HumidiFi", value: "4" },
] as const;

const TIMEFRAMES = [
  { label: "1 Hour", value: "1" },
  { label: "4 Hours", value: "4" },
  { label: "1 Day", value: "24" },
  { label: "1 Week", value: "168" },
] as const;

export const TraderDashboard: React.FC<{ onNavigate: (view: Views) => void }> = ({
  onNavigate,
}) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3333";
  const { address, isConnected, isCorrectNetwork, switchToTargetNetwork } = useEvmWallet();
  const [pseudo, setPseudo] = useState("");
  const [seasonPrice, setSeasonPrice] = useState("25");
  const [market, setMarket] = useState<string>("");
  const [side, setSide] = useState<string>("");
  const [entryKind, setEntryKind] = useState<string>("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [takeProfitSize, setTakeProfitSize] = useState("");
  const [sizeUsd, setSizeUsd] = useState("");
  const [leverage, setLeverage] = useState("");
  const [venue, setVenue] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [lastProtectedDataAddr, setLastProtectedDataAddr] = useState<string | null>(null);

  const [isTrader, setIsTrader] = useState(false);
  const [traderPseudo, setTraderPseudo] = useState("");
  const [currentSeasonId, setCurrentSeasonId] = useState<bigint>(0n);
  const [currentSeasonStatus, setCurrentSeasonStatus] = useState<"OPEN" | "CLOSED" | "NONE">(
    "NONE"
  );
  const [currentSeasonPrice, setCurrentSeasonPrice] = useState<bigint>(0n);
  const [currentSeasonSignals, setCurrentSeasonSignals] = useState<bigint>(0n);

  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [openingSeason, setOpeningSeason] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canTransact = isConnected && isCorrectNetwork && Boolean(SHINGO_HUB_ADDRESS);
  const currentSeasonPriceDisplay = useMemo(
    () => `${Number(formatToken(currentSeasonPrice)).toFixed(2)} ${PAYMENT_TOKEN_SYMBOL}`,
    [currentSeasonPrice]
  );

  async function refreshTraderState() {
    if (!address || !SHINGO_HUB_ADDRESS) return;
    setLoading(true);
    try {
      const hub = getReadHubContract();
      const trader = toTraderView(await hub.getTrader(address));
      setIsTrader(true);
      setTraderPseudo(trader.pseudo);
      setCurrentSeasonId(trader.currentSeasonId);

      if (trader.currentSeasonId > 0n) {
        const season = toSeasonView(await hub.getSeason(trader.currentSeasonId));
        setCurrentSeasonStatus(season.status === 0 ? "OPEN" : "CLOSED");
        setCurrentSeasonPrice(season.priceToken);
        setCurrentSeasonSignals(season.signalCount);
      } else {
        setCurrentSeasonStatus("NONE");
        setCurrentSeasonPrice(0n);
        setCurrentSeasonSignals(0n);
      }
    } catch {
      setIsTrader(false);
      setTraderPseudo("");
      setCurrentSeasonId(0n);
      setCurrentSeasonStatus("NONE");
      setCurrentSeasonPrice(0n);
      setCurrentSeasonSignals(0n);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshTraderState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function runTx(
    fn: () => Promise<{ hash: string; wait: () => Promise<unknown> }>,
    successPrefix: string
  ) {
    setMessage(null);
    setError(null);

    if (!address || !isConnected) {
      setError("Connect wallet first");
      return null;
    }
    if (!SHINGO_HUB_ADDRESS) {
      setError("Missing NEXT_PUBLIC_SHINGO_HUB_ADDRESS");
      return null;
    }
    if (!isCorrectNetwork) {
      setError("Switch to Arbitrum target network first");
      return null;
    }

    try {
      await switchToTargetNetwork();
      const tx = await fn();
      await tx.wait();
      setMessage(`${successPrefix} · ${tx.hash}`);
      await refreshTraderState();
      return tx.hash;
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Transaction failed");
      return null;
    }
  }

  async function fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 3,
    delayMs = 800
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

  async function registerTrader(e: React.FormEvent) {
    e.preventDefault();
    if (!pseudo.trim()) {
      setError("Pseudo is required");
      return;
    }
    setRegistering(true);
    await runTx(async () => {
      const hub = await getWriteHubContract();
      const feeOverrides = await getWriteFeeOverrides();
      return hub.registerTrader(pseudo.trim(), feeOverrides);
    }, "Trader registered");
    setRegistering(false);
  }

  async function openSeason(e: React.FormEvent) {
    e.preventDefault();
    if (!seasonPrice.trim()) {
      setError("Season price is required");
      return;
    }

    setOpeningSeason(true);
    await runTx(async () => {
      const hub = await getWriteHubContract();
      const price = parseUnits(seasonPrice, PAYMENT_TOKEN_DECIMALS);
      const feeOverrides = await getWriteFeeOverrides();
      return hub.openSeason(price, feeOverrides);
    }, "Season opened");
    setOpeningSeason(false);
  }

  async function publishSignal(e: React.FormEvent) {
    e.preventDefault();
    if (!market || !side || !entryKind || !venue || !timeframe) {
      setError("Market, side, entry type, venue and timeframe are required");
      return;
    }
    if (!entryPrice || !stopLoss || !takeProfitPrice || !takeProfitSize || !sizeUsd || !leverage) {
      setError("All signal fields are required");
      return;
    }
    if (!Number.isFinite(Number(entryPrice)) || Number(entryPrice) <= 0) {
      setError("Entry price must be a positive number");
      return;
    }
    if (!Number.isFinite(Number(stopLoss)) || Number(stopLoss) <= 0) {
      setError("Stop loss must be a positive number");
      return;
    }
    if (!Number.isFinite(Number(takeProfitPrice)) || Number(takeProfitPrice) <= 0) {
      setError("Take profit price must be a positive number");
      return;
    }
    if (
      !Number.isFinite(Number(takeProfitSize)) ||
      Number(takeProfitSize) <= 0 ||
      Number(takeProfitSize) > 100
    ) {
      setError("Take profit size must be between 0 and 100");
      return;
    }
    if (!Number.isFinite(Number(sizeUsd)) || Number(sizeUsd) <= 0) {
      setError("Size (USD) must be a positive number");
      return;
    }
    if (
      !Number.isFinite(Number(leverage)) ||
      Number(leverage) < 1 ||
      Number(leverage) > 100 ||
      !Number.isInteger(Number(leverage))
    ) {
      setError("Leverage must be an integer between 1 and 100");
      return;
    }

    const selectedMarket = MARKETS.find((m) => m.label === market);
    const selectedSide = SIDES.find((s) => s.value === side);
    const selectedEntryKind = ENTRY_KINDS.find((k) => k.value === entryKind);
    const selectedVenue = VENUES.find((v) => v.value === venue);
    const selectedTimeframe = TIMEFRAMES.find((t) => t.value === timeframe);

    if (!selectedMarket || !selectedSide || !selectedEntryKind || !selectedVenue || !selectedTimeframe) {
      setError("Invalid signal field selection");
      return;
    }

    setMessage("Encrypting signal payload with iExec...");
    setError(null);
    setPublishing(true);
    try {
      const protectResp = await fetchWithRetry(`${backendUrl}/tee/protect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedMarket.label} ${selectedSide.label} @ ${entryPrice}`,
          payload: {
            market: selectedMarket.label,
            marketBase: selectedMarket.left,
            marketQuote: selectedMarket.right,
            side: Number(side),
            sideLabel: selectedSide.label,
            entryKind: Number(entryKind),
            entryKindLabel: selectedEntryKind.label,
            entryPrice: Number(entryPrice),
            stopLoss: Number(stopLoss),
            takeProfitPrice: Number(takeProfitPrice),
            takeProfitSize: Number(takeProfitSize),
            sizeUsd: Number(sizeUsd),
            leverage: Number(leverage),
            venue: Number(venue),
            venueLabel: selectedVenue.label,
            timeframe: Number(timeframe),
            timeframeLabel: selectedTimeframe.label,
            // Backward compatibility fields used by older consumers.
            entry: Number(entryPrice),
            stop: Number(stopLoss),
            takeProfit: Number(takeProfitPrice),
            seasonId: currentSeasonId.toString(),
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const protectResult = await protectResp.json();
      if (!protectResp.ok) {
        throw new Error(protectResult?.error ?? "iExec protectData failed");
      }
      if (!protectResult?.address) {
        throw new Error("Invalid iExec response: missing protected data address");
      }

      setLastProtectedDataAddr(protectResult.address as string);

      const txHash = await runTx(async () => {
        const hub = await getWriteHubContract();
        const feeOverrides = await getWriteFeeOverrides();
        return hub.publishSignal(protectResult.address, feeOverrides);
      }, "Signal encrypted + published");

      if (txHash && currentSeasonId > 0n) {
        try {
          const syncResp = await fetchWithRetry(
            `${backendUrl}/tee/grant-season-subscribers`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                seasonId: currentSeasonId.toString(),
                protectedDataAddr: protectResult.address,
              }),
            },
            2,
            600
          );
          if (!syncResp.ok) {
            // Non-blocking: on-chain-first relay catches up from events.
            setMessage("Signal published on-chain. TEE access sync will be caught up by relay.");
          }
        } catch {
          // Non-blocking: on-chain-first relay catches up from events.
          setMessage("Signal published on-chain. TEE access sync will be caught up by relay.");
        }
      }
    } catch (e: any) {
      const message = e?.shortMessage ?? e?.message ?? "Signal encryption failed";
      if (String(message).toLowerCase().includes("failed to fetch")) {
        setError(
          `TEE backend unreachable at ${backendUrl}. Wait a few seconds and retry (API may still be starting).`
        );
      } else {
        setError(message);
      }
    } finally {
      setPublishing(false);
    }
  }

  async function closeSeason() {
    const seasonToClose = currentSeasonId;
    setClosing(true);
    const txHash = await runTx(async () => {
      const hub = await getWriteHubContract();
      const feeOverrides = await getWriteFeeOverrides();
      return hub.closeSeason(feeOverrides);
    }, "Season closed");

    if (txHash && seasonToClose > 0n) {
      try {
        const syncResp = await fetch(`${backendUrl}/tee/publicize-season`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonId: seasonToClose.toString(),
          }),
        });
        if (!syncResp.ok) {
          setMessage("Season closed on-chain. Public TEE access will be caught up by relay.");
        }
      } catch (e: any) {
        setMessage("Season closed on-chain. Public TEE access will be caught up by relay.");
      }
    }
    setClosing(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Creator Studio
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Full on-chain flow: register trader, open season, publish protected signal, close season.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-slate-300 dark:border-slate-300 dark:border-white/15 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70"
          onClick={() => onNavigate(Views.SIGNALS)}
        >
          Open signals terminal
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="glass-panel border-violet-300/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl text-slate-900 dark:text-white">
              <UploadCloud className="h-5 w-5 text-violet-200" />
              On-chain actions
            </CardTitle>
            <CardDescription>
              ShingoHub contract address:{" "}
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                {SHINGO_HUB_ADDRESS ? shortenAddress(SHINGO_HUB_ADDRESS, 10, 8) : "missing"}
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {!isTrader && (
              <form className="space-y-3 rounded-xl border border-amber-300/35 bg-amber-400/10 p-4" onSubmit={registerTrader}>
                <p className="text-sm text-amber-100">
                  Register your trader identity first (unique pseudo on-chain).
                </p>
                <div>
                  <Label htmlFor="pseudo">Pseudo</Label>
                  <Input
                    id="pseudo"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    placeholder="ex: alpha_sensei"
                    className="mt-2 border-amber-200/30 bg-white/80 dark:bg-white/80 dark:bg-slate-950/80"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200"
                  disabled={registering || !canTransact}
                >
                  {registering ? "Registering..." : "Register trader"}
                </Button>
              </form>
            )}

            {isTrader && (
              <>
                <form className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-4" onSubmit={openSeason}>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Open a new season with a fixed subscription price.
                  </p>
                  <div>
                    <Label htmlFor="seasonPrice">
                      Season price ({PAYMENT_TOKEN_SYMBOL})
                    </Label>
                    <Input
                      id="seasonPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={seasonPrice}
                      onChange={(e) => setSeasonPrice(e.target.value)}
                      className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-red-600 text-slate-900 dark:text-white hover:bg-red-500"
                    disabled={openingSeason || !canTransact || currentSeasonStatus === "OPEN"}
                  >
                    {openingSeason ? "Opening..." : "Open season"}
                  </Button>
                </form>

                <form className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-4" onSubmit={publishSignal}>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Encrypt payload with iExec TEE then publish metadata on-chain.
                  </p>
                  <div>
                    <Label htmlFor="signalSeason">Season</Label>
                    <Input
                      id="signalSeason"
                      value={currentSeasonId > 0n ? `#${currentSeasonId.toString()}` : "No active season"}
                      readOnly
                      className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/60 dark:bg-slate-100/60 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="signalMarket">Market</Label>
                      <Select value={market} onValueChange={setMarket}>
                        <SelectTrigger id="signalMarket" className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80">
                          <SelectValue placeholder="Select market" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKETS.map((item) => (
                            <SelectItem key={item.label} value={item.label}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signalSide">Side</Label>
                      <Select value={side} onValueChange={setSide}>
                        <SelectTrigger id="signalSide" className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80">
                          <SelectValue placeholder="Select side" />
                        </SelectTrigger>
                        <SelectContent>
                          {SIDES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signalEntryType">Entry Type</Label>
                      <Select value={entryKind} onValueChange={setEntryKind}>
                        <SelectTrigger id="signalEntryType" className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTRY_KINDS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signalEntryPrice">Entry Price</Label>
                      <Input
                        id="signalEntryPrice"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        placeholder="65000"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signalStopLoss">Stop Loss</Label>
                      <Input
                        id="signalStopLoss"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder="63000"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signalTakeProfitPrice">Take Profit Price</Label>
                      <Input
                        id="signalTakeProfitPrice"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={takeProfitPrice}
                        onChange={(e) => setTakeProfitPrice(e.target.value)}
                        placeholder="70000"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signalTakeProfitSize">Take Profit Size (%)</Label>
                      <Input
                        id="signalTakeProfitSize"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={takeProfitSize}
                        onChange={(e) => setTakeProfitSize(e.target.value)}
                        placeholder="100"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signalSizeUsd">Size (USD)</Label>
                      <Input
                        id="signalSizeUsd"
                        type="number"
                        min="0"
                        step="0.01"
                        value={sizeUsd}
                        onChange={(e) => setSizeUsd(e.target.value)}
                        placeholder="1000"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label htmlFor="signalLeverage">Leverage</Label>
                      <Input
                        id="signalLeverage"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        placeholder="10"
                        className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signalVenue">Venue</Label>
                      <Select value={venue} onValueChange={setVenue}>
                        <SelectTrigger id="signalVenue" className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80">
                          <SelectValue placeholder="Venue" />
                        </SelectTrigger>
                        <SelectContent>
                          {VENUES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signalTimeframe">Timeframe</Label>
                      <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger id="signalTimeframe" className="mt-2 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-100/80 dark:bg-slate-900/80">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEFRAMES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {lastProtectedDataAddr && (
                    <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-3 text-xs">
                      <p className="mb-1 text-emerald-100">Last protectedDataAddr</p>
                      <p className="break-all font-mono text-emerald-200">{lastProtectedDataAddr}</p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-red-600 text-slate-900 dark:text-white hover:bg-red-500"
                    disabled={publishing || !canTransact || currentSeasonStatus !== "OPEN"}
                  >
                    {publishing ? "Encrypting + publishing..." : "Encrypt + Publish signal"}
                  </Button>
                </form>

                <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-4">
                  <p className="mb-3 text-sm text-rose-100">
                    Closing a season makes all season signals public.
                  </p>
                  <Button
                    className="w-full bg-rose-300 text-slate-950 hover:bg-rose-200"
                    disabled={closing || !canTransact || currentSeasonStatus !== "OPEN"}
                    onClick={closeSeason}
                  >
                    {closing ? "Closing..." : "Close season"}
                  </Button>
                </div>
              </>
            )}

            {error && <Badge variant="destructive">{error}</Badge>}
            {message && (
              <Badge className="whitespace-normal break-all border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
                {message}
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-panel border-slate-200 dark:border-slate-200 dark:border-white/10">
            <CardHeader>
              <CardTitle className="font-display text-xl text-slate-900 dark:text-white">Status</CardTitle>
              <CardDescription>Live state from ShingoHub.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                <span className="text-slate-600 dark:text-slate-300">Wallet</span>
                <span className="font-mono text-slate-800 dark:text-slate-100">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                <span className="text-slate-600 dark:text-slate-300">Trader profile</span>
                <span className="font-mono text-slate-800 dark:text-slate-100">{loading ? "loading..." : isTrader ? "active" : "missing"}</span>
              </div>
              {isTrader && (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                    <span className="text-slate-600 dark:text-slate-300">Pseudo</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100">{traderPseudo}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                    <span className="text-slate-600 dark:text-slate-300">Current season</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100">
                      {currentSeasonId > 0n ? `#${currentSeasonId.toString()}` : "none"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                    <span className="text-slate-600 dark:text-slate-300">Season status</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100">{currentSeasonStatus}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                    <span className="text-slate-600 dark:text-slate-300">Price</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100">{currentSeasonPriceDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/70 dark:bg-slate-950/70 p-3">
                    <span className="text-slate-600 dark:text-slate-300">Signals in season</span>
                    <span className="font-mono text-slate-800 dark:text-slate-100">{currentSeasonSignals.toString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel border-slate-200 dark:border-slate-200 dark:border-white/10">
            <CardHeader>
              <CardTitle className="font-display text-xl text-slate-900 dark:text-white">Flow checklist</CardTitle>
              <CardDescription>Expected sequence for end-to-end usage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>1. Register trader (once)</p>
              <p>2. Open season and set fixed price</p>
              <p>3. Click Encrypt + Publish (iExec + on-chain in one flow)</p>
              <p>4. Subscribers pay and receive access rights</p>
              <p>5. Close season to make all season signals public</p>
            </CardContent>
          </Card>

          <Card className="glass-panel border-violet-300/20">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-violet-100">
              <Lock className="mt-0.5 h-4 w-4" />
              The contract stores only metadata. Encryption/decryption stays in the iExec TEE flow.
            </CardContent>
          </Card>

          <Card className="glass-panel border-slate-200 dark:border-slate-200 dark:border-white/10">
            <CardContent className="space-y-2 p-4 text-sm">
              <p className="text-slate-600 dark:text-slate-300">Contract explorer</p>
              <a
                href={SHINGO_HUB_ADDRESS ? `https://sepolia.arbiscan.io/address/${SHINGO_HUB_ADDRESS}` : "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-red-200 hover:text-red-100"
              >
                View on Arbiscan
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
