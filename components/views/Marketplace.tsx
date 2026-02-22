"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Views } from "@/types";
import { ArrowUpRight, Search } from "lucide-react";
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
import { WalletAvatar } from "@/components/ui/wallet-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortenAddress } from "@/lib/utils";
import {
  SeasonView,
  TraderView,
  formatToken,
  getSeasonSubscribersSafe,
  getPublicProvider,
  getReadHubContract,
} from "@/lib/evm/contracts";
import {
  LOG_LOOKBACK_BLOCKS,
  SHINGO_DEPLOY_BLOCK,
  SHINGO_HUB_ADDRESS,
  PAYMENT_TOKEN_SYMBOL,
} from "@/lib/evm/config";

const RISK_OPTIONS = ["Open season", "Closed season"] as const;

type TraderCard = {
  id: string;
  pseudo: string;
  wallet: string;
  currentSeasonId: number;
  statusLabel: "Open season" | "Closed season";
  subscriptionPrice: string;
  subscribers: number;
  signalCount: number;
  description: string;
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

export const Marketplace: React.FC<{ onNavigate: (view: Views, params?: any) => void }> = ({
  onNavigate,
}) => {
  const [filterState, setFilterState] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [traders, setTraders] = useState<TraderCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!SHINGO_HUB_ADDRESS) {
        setError("Missing NEXT_PUBLIC_SHINGO_HUB_ADDRESS");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const provider = getPublicProvider();
        const hub = getReadHubContract();
        const latestBlock = await provider.getBlockNumber();
        const fromBlock =
          SHINGO_DEPLOY_BLOCK > 0
            ? SHINGO_DEPLOY_BLOCK
            : Math.max(0, latestBlock - LOG_LOOKBACK_BLOCKS);
        const logs = await hub.queryFilter(
          hub.filters.TraderRegistered(),
          fromBlock,
          latestBlock
        );
        const uniqueWallets = [...new Set(logs.map((log: any) => String(log.args?.trader ?? "")))].filter(
          Boolean
        );

        const rows = await Promise.all(
          uniqueWallets.map(async (wallet) => {
            try {
              const trader = toTraderView(await hub.getTrader(wallet));
              let season: SeasonView | null = null;
              let subscriberCount = 0;

              if (trader.currentSeasonId > 0n) {
                season = toSeasonView(await hub.getSeason(trader.currentSeasonId));
                const subscribers = await getSeasonSubscribersSafe(hub, trader.currentSeasonId);
                subscriberCount = subscribers.length;
              }

              const statusOpen = season?.status === 0;
              return {
                id: wallet,
                pseudo: trader.pseudo || shortenAddress(wallet, 8, 6),
                wallet,
                currentSeasonId: Number(trader.currentSeasonId),
                statusLabel: statusOpen ? "Open season" : "Closed season",
                subscriptionPrice: season ? formatToken(season.priceToken) : "0",
                subscribers: subscriberCount,
                signalCount: season ? Number(season.signalCount) : 0,
                description: statusOpen
                  ? `Current season is open for subscriptions`
                  : "No active season right now",
              } as TraderCard;
            } catch {
              return null;
            }
          })
        );

        setTraders(rows.filter(Boolean) as TraderCard[]);
      } catch (e: any) {
        setError(e?.shortMessage ?? e?.message ?? "Failed to load on-chain traders");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    return traders.filter((t) => {
      if (filterState && t.statusLabel !== filterState) return false;
      if (
        searchTerm &&
        !t.pseudo.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !t.wallet.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [traders, filterState, searchTerm]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Alpha Marketplace
        </h2>
        <p className="max-w-2xl text-slate-600 dark:text-slate-300">
          Discover active traders on Arbitrum and subscribe to the current season.
        </p>
      </div>

      <Card className="glass-panel border-slate-200 dark:border-slate-200 dark:border-white/10">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pseudo or wallet"
              className="h-10 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/80 dark:bg-slate-950/80 pl-9"
            />
          </div>

          <div className="w-full md:w-56">
            <Select
              value={filterState ?? "all"}
              onValueChange={(value) => setFilterState(value === "all" ? null : value)}
            >
              <SelectTrigger className="h-10 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/80 dark:bg-slate-950/80">
                <SelectValue placeholder="Season status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All traders</SelectItem>
                {RISK_OPTIONS.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            className="h-10 border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/80 dark:bg-slate-950/80"
            onClick={() => {
              setSearchTerm("");
              setFilterState(null);
            }}
          >
            Reset filters
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-400/30 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-200">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <Card className="border-red-400/25 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-100">Loading on-chain traders...</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((trader) => (
          <Card
            key={trader.id}
            onClick={() =>
              onNavigate(Views.PROFILE, {
                traderId: trader.id,
                traderAddr: trader.wallet,
              })
            }
            className="group cursor-pointer border-slate-200 dark:border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-950/50 transition duration-300 hover:-translate-y-1 hover:border-red-400/40 hover:bg-slate-100/70 dark:hover:bg-slate-100/70 dark:bg-slate-900/70"
          >
            <CardHeader className="space-y-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
                  <WalletAvatar address={trader.wallet} size={44} />
                  <div className="min-w-0">
                    <CardTitle className="truncate font-display text-lg text-slate-900 dark:text-white" title={trader.pseudo}>
                      {trader.pseudo}
                    </CardTitle>
                    <CardDescription className="truncate text-xs" title={trader.wallet}>
                      {shortenAddress(trader.wallet, 8, 6)}
                    </CardDescription>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition group-hover:text-red-200" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="border-red-400/30 bg-red-500/10 text-red-100">
                  {trader.statusLabel}
                </Badge>
                <Badge variant="outline" className="border-slate-300 dark:border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300">
                  season #{trader.currentSeasonId || "-"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <p className="line-clamp-2 text-sm text-slate-300">{trader.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-900/80 p-2">
                  <p className="font-mono text-[10px] uppercase text-slate-500">Signals</p>
                  <p className="text-slate-200">{trader.signalCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-900/80 p-2">
                  <p className="font-mono text-[10px] uppercase text-slate-500">Subs</p>
                  <p className="text-slate-200">{trader.subscribers}</p>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase text-slate-500">Season price</p>
                  <p
                    className="truncate font-mono text-lg text-red-100"
                    title={`${trader.subscriptionPrice} ${PAYMENT_TOKEN_SYMBOL}`}
                  >
                    {Number(trader.subscriptionPrice).toFixed(2)} {PAYMENT_TOKEN_SYMBOL}
                  </p>
                </div>
                <Badge variant="outline" className="border-red-400/30 text-red-200">
                  Open profile
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && !loading && (
          <Card className="border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-950/60 md:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-sm text-slate-400">
              No trader found with current filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
