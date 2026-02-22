import React, { ReactNode, useMemo, useState } from "react";
import { Views } from "@/types";
import {
  Activity,
  LineChart,
  Menu,
  Moon,
  Rocket,
  Shield,
  Sun,
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
import { useTheme } from "@/lib/theme";

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
  const { theme, toggle } = useTheme();
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

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
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
              <p className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                SHINGO
              </p>
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Arbitrum Signal Layer
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/70 p-1 lg:flex dark:border-white/10 dark:bg-slate-900/70">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.view;
              return (
                <Button
                  key={item.view}
                  variant={active ? "secondary" : "ghost"}
                  className={cn(
                    "h-9 rounded-lg px-3 text-xs font-medium",
                    active && "bg-red-500/20 text-red-700 dark:text-red-100"
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
              className="text-slate-600 dark:text-slate-300"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {connected ? (
              <>
                <Badge variant="secondary" className="gap-1 border border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
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
                <code className="rounded-md border border-slate-300 bg-slate-100/80 px-2 py-1 font-mono text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200">
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
            <SheetContent side="right" className="border-slate-200 bg-slate-50/95 dark:border-white/10 dark:bg-slate-950/95">
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
                    <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 font-mono text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
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
                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 dark:border-white/10 dark:bg-slate-900">
                    <Button
                      className="w-full"
                      onClick={() => connect()}
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Connecting..." : "Connect wallet"}
                    </Button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-slate-600 dark:text-slate-300"
                  onClick={toggle}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? "Mode clair" : "Mode sombre"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="mt-20 border-t border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl font-semibold text-slate-900 dark:text-white">Shingo Protocol</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Encrypted signals. On-chain subscriptions. Non-custodial settlement.
              </p>
            </div>
            <Badge variant="outline" className="gap-1 border-red-400/35 text-red-600 dark:text-red-200">
              <Wallet className="h-3 w-3" />
              Testnet ready
            </Badge>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>© 2026 Shingo.</span>
            <div className="flex items-center gap-4 font-mono uppercase tracking-wider">
              <a href="#" className="hover:text-red-600 dark:hover:text-red-200">
                Docs
              </a>
              <a href="#" className="hover:text-red-600 dark:hover:text-red-200">
                Privacy
              </a>
              <a href="#" className="hover:text-red-600 dark:hover:text-red-200">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
