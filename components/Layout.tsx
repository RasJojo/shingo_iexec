import React, { ReactNode, useMemo, useState } from "react";
import { Views } from "@/types";
import {
  Activity,
  LineChart,
  Menu,
  Rocket,
  Shield,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useEvmWallet } from "@/lib/evm/wallet";
import { TARGET_CHAIN_ID } from "@/lib/evm/config";

interface LayoutProps {
  children: ReactNode;
  currentView: Views;
  onNavigate: (view: Views) => void;
  isConnected: boolean;
}

const NAV_ITEMS = [
  { label: "Marketplace", view: Views.MARKETPLACE, icon: Rocket },
  { label: "Signals", view: Views.SIGNALS, icon: Activity },
  { label: "Creator", view: Views.DASHBOARD_TRADER, icon: LineChart },
];

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  onNavigate,
  isConnected,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    address,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToTargetNetwork,
    isConnecting,
  } = useEvmWallet();
  const connected = isConnected || Boolean(address);

  const shortAddress = useMemo(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  const disconnectWallet = () => {
    disconnect();
    localStorage.removeItem("authToken");
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-noise opacity-20" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid-soft mask-fade-bottom opacity-25" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate(Views.LANDING)}
            className="group inline-flex items-center gap-3"
          >
            <div className="relative rounded-xl border border-red-400/30 bg-red-500/10 p-1.5 shadow-glow">
              <Image src="/logoshingo.svg" alt="Shingo" width={28} height={28} />
            </div>
            <div className="text-left">
              <p className="font-display text-base font-semibold tracking-tight text-white">
                SHINGO
              </p>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-400">
                Arbitrum Signal Layer
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 p-1 lg:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.view;
              return (
                <Button
                  key={item.view}
                  variant={active ? "secondary" : "ghost"}
                  className={cn(
                    "h-9 rounded-lg px-3 text-xs font-medium",
                    active && "bg-red-500/20 text-red-100"
                  )}
                  onClick={() => onNavigate(item.view)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {connected ? (
              <>
                <Badge variant="secondary" className="gap-1 border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  <Shield className="h-3 w-3" />
                  Wallet linked
                </Badge>
                {!isCorrectNetwork && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => switchToTargetNetwork()}
                  >
                    Switch to {TARGET_CHAIN_ID}
                  </Button>
                )}
                <code className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200">
                  {shortAddress}
                </code>
                <Button variant="outline" size="sm" onClick={disconnectWallet}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={() => connect()} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect wallet"}
              </Button>
            )}
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-white/10 bg-slate-950/95">
              <SheetHeader>
                <SheetTitle className="font-display">Navigation</SheetTitle>
                <SheetDescription>
                  Explore the marketplace and manage encrypted signals.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-8 space-y-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.view}
                      variant={currentView === item.view ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        onNavigate(item.view);
                        setMobileOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
              <Separator className="my-6" />
              <div className="space-y-3">
                {connected ? (
                  <>
                    <div className="rounded-lg border border-white/10 bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      {shortAddress}
                    </div>
                    {!isCorrectNetwork && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => switchToTargetNetwork()}
                      >
                        Switch to {TARGET_CHAIN_ID}
                      </Button>
                    )}
                    <Button variant="outline" className="w-full" onClick={disconnectWallet}>
                      Disconnect wallet
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-slate-900 p-3">
                    <Button
                      className="w-full"
                      onClick={() => connect()}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Connecting..." : "Connect wallet"}
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="mt-20 border-t border-white/10 bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl font-semibold text-white">Shingo Protocol</p>
              <p className="text-sm text-slate-400">
                Encrypted signals. On-chain subscriptions. Non-custodial settlement.
              </p>
            </div>
            <Badge variant="outline" className="gap-1 border-red-400/35 text-red-200">
              <Wallet className="h-3 w-3" />
              Testnet ready
            </Badge>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>© 2026 Shingo.</span>
            <div className="flex items-center gap-4 font-mono uppercase tracking-wider">
              <a href="#" className="hover:text-red-200">
                Docs
              </a>
              <a href="#" className="hover:text-red-200">
                Privacy
              </a>
              <a href="#" className="hover:text-red-200">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
