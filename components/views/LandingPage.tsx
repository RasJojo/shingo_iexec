import React from "react";
import { Views } from "@/types";
import { ArrowRight, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TICKER = [
  { pair: "ARB/USDC", value: "1.213", move: "+2.1%" },
  { pair: "BTC/USD", value: "64,204", move: "-1.2%" },
  { pair: "ETH/USDC", value: "3,402", move: "+0.5%" },
  { pair: "SOL/USDC", value: "192.4", move: "+3.7%" },
  { pair: "ETH/USD", value: "3,402", move: "+0.5%" },
];

const FEATURES = [
  {
    title: "Encryption by default",
    description:
      "Signal payloads are encrypted through iExec TEE before sharing with followers.",
    icon: Lock,
  },
  {
    title: "On-chain verification",
    description:
      "Season subscriptions and signal references are settled on-chain on Arbitrum.",
    icon: ShieldCheck,
  },
  {
    title: "Execution-ready",
    description:
      "Traders can open seasons, set a fixed price, then publish protected signal references.",
    icon: Zap,
  },
];

const Marquee: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative overflow-hidden">
    <div className="flex min-w-max animate-marquee gap-8 py-2">{children}{children}</div>
  </div>
);

export const LandingPage: React.FC<{
  onNavigate: (view: Views, params?: { traderId?: string }) => void;
}> = ({ onNavigate }) => {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-10">
        <div className="space-y-8">
          <Badge className="rounded-full border-red-400/35 bg-red-500/10 px-4 py-1 text-red-100">
            <Sparkles className="h-3.5 w-3.5" />
            Protocol v1 live on Arbitrum testnet
          </Badge>

          <div className="space-y-5">
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-gray-950 dark:text-white sm:text-6xl lg:text-7xl">
              Verified alpha for
              <span className="text-gradient"> serious copy trading.</span>
            </h1>
            <p className="max-w-2xl text-base text-gray-700 dark:text-slate-300 sm:text-lg">
              Shingo is a non-custodial signal marketplace with encrypted delivery,
              transparent access control, and a clean execution flow for subscribers.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-11 rounded-xl bg-red-600 text-gray-950 dark:text-white hover:bg-red-500"
              onClick={() => onNavigate(Views.MARKETPLACE)}
            >
              Explore marketplace
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 rounded-xl border-slate-300 dark:border-slate-400 dark:border-white/20 bg-slate-50/70 dark:bg-slate-50/70 dark:bg-slate-950/60"
              onClick={() => onNavigate(Views.DASHBOARD_TRADER)}
            >
              Open creator studio
            </Button>
          </div>
        </div>

        <Card className="glass-panel overflow-hidden border-red-400/20 shadow-glow">
          <CardHeader className="border-b border-slate-200 dark:border-slate-300 dark:border-white/10">
            <CardTitle className="font-display text-xl">Live signal relay</CardTitle>
            <CardDescription>
              Snapshot of the encrypted publish pipeline for current market conditions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-lg border border-slate-200 dark:border-slate-300 dark:border-white/10 bg-white/90 dark:bg-white/90 dark:bg-slate-950/70 p-3 font-mono text-xs">
              <div className="mb-2 flex items-center justify-between text-gray-600 dark:text-slate-400">
                <span>{">"} STREAM</span>
                <span className="text-emerald-300">healthy</span>
              </div>
              <div className="space-y-1.5 text-gray-800 dark:text-slate-200">
                <p>{">"} signal_encrypted = true</p>
                <p>{">"} tee_dataset = protected</p>
                <p>{">"} tx_digest = 0xa84...b10</p>
                <p>{">"} shingo_season = active</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-300 dark:border-white/10 bg-slate-50/70 dark:bg-slate-50/70 dark:bg-slate-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-400">24h PnL</p>
                <p className="font-mono text-lg font-semibold text-emerald-300">+12.4%</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-300 dark:border-white/10 bg-slate-50/70 dark:bg-slate-50/70 dark:bg-slate-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-400">Signals</p>
                <p className="font-mono text-lg font-semibold text-gray-950 dark:text-white">48</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-300 dark:border-white/10 bg-slate-50/70 dark:bg-slate-50/70 dark:bg-slate-950/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-400">Winrate</p>
                <p className="font-mono text-lg font-semibold text-red-200">71%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="my-14 rounded-xl border border-slate-200 dark:border-slate-300 dark:border-white/10 bg-white/65 dark:bg-slate-950/65">
        <Marquee>
          {TICKER.map((item) => (
            <div
              key={`${item.pair}-${item.move}`}
              className="flex items-center gap-3 border-r border-slate-200 dark:border-slate-300 dark:border-white/10 px-6 py-2 font-mono text-sm"
            >
              <span className="text-gray-600 dark:text-slate-400">{item.pair}</span>
              <span className="text-gray-950 dark:text-white">{item.value}</span>
              <span className={item.move.startsWith("+") ? "text-emerald-300" : "text-rose-300"}>
                {item.move}
              </span>
            </div>
          ))}
        </Marquee>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="glass-panel border-slate-200 dark:border-slate-300 dark:border-white/10">
              <CardHeader>
                <Badge variant="secondary" className="w-fit gap-2 border border-red-400/25 bg-red-500/10 text-red-100">
                  <Icon className="h-3.5 w-3.5" />
                  Core
                </Badge>
                <CardTitle className="font-display text-xl text-gray-950 dark:text-white">{feature.title}</CardTitle>
                <CardDescription className="text-gray-700 dark:text-slate-300">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>
    </div>
  );
};
