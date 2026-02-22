import React from "react";
import { Views } from "@/types";
import { AlertTriangle, Settings2, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const SubscriberDashboard: React.FC<{ onNavigate: (view: Views) => void }> = ({
  onNavigate,
}) => {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Command Center
        </h2>
        <p className="text-slate-300">Active subscriptions and real-time performance snapshot.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="glass-panel border-slate-300 dark:border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-xl text-white">Sui_Whale_V2</CardTitle>
                <CardDescription>Encrypted feed status: active</CardDescription>
              </div>
              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200">Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Renewal</p>
                <p className="font-mono text-sm text-white">12 days</p>
              </div>
              <div className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Current ROI</p>
                <p className="font-mono text-sm text-emerald-300">+8.4%</p>
              </div>
              <div className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Signals 24h</p>
                <p className="font-mono text-sm text-white">7</p>
              </div>
              <div className="rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50/80 dark:bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Risk tier</p>
                <p className="font-mono text-sm text-red-200">Balanced</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-red-600 text-white hover:bg-red-500"
                onClick={() => onNavigate(Views.SIGNALS)}
              >
                <Terminal className="h-4 w-4" />
                Open terminal
              </Button>
              <Button variant="outline" className="border-slate-400 dark:border-white/15 bg-slate-50/80 dark:bg-slate-950/70">
                <Settings2 className="h-4 w-4" />
                Manage settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-emerald-300/20">
          <CardHeader>
            <CardTitle className="font-display text-xl text-white">Portfolio health</CardTitle>
            <CardDescription>Aggregated across active subscriptions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-4xl font-semibold text-emerald-300">+6.3%</p>
            <p className="text-sm text-slate-300">Positive momentum over the last 7 days.</p>
            <div className="rounded-lg border border-amber-200/20 bg-amber-300/10 p-3 text-xs text-amber-100">
              <p className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Advisory
              </p>
              Review max drawdown before scaling copy size.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
