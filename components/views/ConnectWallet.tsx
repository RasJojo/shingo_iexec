import React, { useEffect, useState } from "react";
import { Views } from "@/types";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEvmWallet } from "@/lib/evm/wallet";
import { TARGET_CHAIN_ID } from "@/lib/evm/config";
import { shortenAddress } from "@/lib/utils";

export const ConnectWallet: React.FC<{
  onNavigate: (view: Views) => void;
  onConnect: () => void;
}> = ({ onNavigate, onConnect }) => {
  const {
    address,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    hasProvider,
    connect,
    disconnect,
    switchToTargetNetwork,
  } = useEvmWallet();
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) {
      onConnect();
    }
  }, [isConnected, onConnect]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col px-4 py-12 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        className="mb-8 w-fit px-2 text-slate-300"
        onClick={() => onNavigate(Views.LANDING)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to landing
      </Button>

      <Card className="glass-panel mx-auto w-full max-w-md border-slate-200 dark:border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 inline-flex rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl text-white">Connect EVM wallet</CardTitle>
          <CardDescription>
            Use MetaMask or Rabby on Arbitrum to access Shingo subscriptions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!hasProvider && (
            <Badge variant="destructive" className="w-full justify-center">
              No EVM wallet detected in browser
            </Badge>
          )}

          {connectError && (
            <div className="rounded-md border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-100">
              {connectError}
              <p className="mt-1 text-rose-200/70">
                Ouvre MetaMask manuellement, va dans Paramètres → Sites connectés et supprime ce domaine, puis réessaie.
              </p>
            </div>
          )}

          {!isConnected ? (
            <Button
              className="w-full bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                setConnectError(null);
                connect().catch((e: any) => {
                  const msg = e?.message ?? String(e);
                  if (msg.includes("rejected") || msg.includes("denied") || e?.code === 4001) {
                    setConnectError("Connexion refusée dans MetaMask. Clique sur \"Connect wallet\" dans la popup.");
                  } else if (msg.includes("already pending")) {
                    setConnectError("Une demande de connexion est déjà en attente. Ouvre MetaMask et accepte-la.");
                  } else {
                    setConnectError(msg);
                  }
                });
              }}
              disabled={isConnecting || !hasProvider}
            >
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </Button>
          ) : (
            <>
              <div
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-950/70 p-3 text-center font-mono text-xs text-slate-200"
                title={address ?? ""}
              >
                {address ? shortenAddress(address, 10, 8) : "Unknown wallet"}
              </div>

              {!isCorrectNetwork ? (
                <Button
                  className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200"
                  onClick={() => switchToTargetNetwork()}
                >
                  Switch to Arbitrum chain ({TARGET_CHAIN_ID})
                </Button>
              ) : (
                <Badge className="w-full justify-center border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
                  Wallet connected on target network
                </Badge>
              )}

              <Button
                variant="outline"
                className="w-full border-slate-300 dark:border-white/15 bg-white/70 dark:bg-slate-950/70"
                onClick={() => {
                  disconnect();
                  localStorage.removeItem("authToken");
                }}
              >
                Disconnect wallet
              </Button>
            </>
          )}

          <p className="pt-2 text-center text-xs text-slate-400">
            No seed phrase or private key is ever requested.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
