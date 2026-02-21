"use client";

import React, { useState } from "react";
import { encode } from "@msgpack/msgpack";
import { BrowserProvider, ethers, getBytes, keccak256 } from "ethers";
import { AlertTriangle, ExternalLink, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useEvmWallet } from "@/lib/evm/wallet";

// ─── Constants ────────────────────────────────────────────────────────────────

const HL_TESTNET_API = "https://api.hyperliquid-testnet.xyz/exchange";
const HL_TESTNET_APP = "https://app.hyperliquid-testnet.xyz/trade";

// EIP-712 domain — TOUJOURS chainId 1337 pour les L1 actions HL (testnet et mainnet)
const PHANTOM_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

// EIP-712 types — on signe un Agent (phantom), pas l'ordre directement
const AGENT_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
} as const;

// ─── Asset index map (testnet = mainnet indices) ───────────────────────────────
const HL_ASSET_INDEX: Record<string, number> = {
  BTC: 0,
  ETH: 1,
  SOL: 2,
  ARB: 4,
  AVAX: 5,
  BNB: 6,
  MATIC: 7,
  OP: 8,
  DOGE: 9,
  LINK: 10,
  SUI: 35,
};

// ─── Signing helpers (portage exact du SDK nomeida/hyperliquid) ───────────────

/**
 * Supprime les zéros de fin d'une string numérique.
 * L'API HL exige que p et s n'aient pas de trailing zeros.
 * Ex: "50000.00" → "50000", "0.12340" → "0.1234"
 */
function removeTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  const normalized = value.replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

/**
 * Normalise récursivement un objet : retire les trailing zeros
 * sur tous les champs "p" (price) et "s" (size).
 */
function normalizeAction<T>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normalizeAction) as unknown as T;

  const result = { ...obj } as Record<string, unknown>;
  for (const key in result) {
    const val = result[key];
    if (val && typeof val === "object") {
      result[key] = normalizeAction(val);
    } else if ((key === "p" || key === "s") && typeof val === "string") {
      result[key] = removeTrailingZeros(val);
    }
  }
  return result as T;
}

/**
 * Convertit un nombre en string HL-compatible (8 décimales max, sans trailing zeros).
 */
function floatToWire(x: number): string {
  const rounded = x.toFixed(8);
  const normalized = rounded.replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

/**
 * actionHash = keccak256( msgpack(action) + nonce(8 bytes BE) + vaultFlag(1 byte) )
 * C'est ce hash qui devient le connectionId du phantom agent.
 */
function actionHash(
  action: unknown,
  vaultAddress: string | null,
  nonce: number
): string {
  const normalized = normalizeAction(action);
  const msgPackBytes = encode(normalized);
  const additionalBytes = vaultAddress === null ? 9 : 29;
  const data = new Uint8Array(msgPackBytes.length + additionalBytes);
  data.set(msgPackBytes);
  const view = new DataView(data.buffer);
  // nonce = uint64 big-endian sur 8 bytes
  view.setBigUint64(msgPackBytes.length, BigInt(nonce), false);
  if (vaultAddress === null) {
    view.setUint8(msgPackBytes.length + 8, 0);
  } else {
    view.setUint8(msgPackBytes.length + 8, 1);
    data.set(getBytes(vaultAddress), msgPackBytes.length + 9);
  }
  return keccak256(data);
}

/**
 * Signe une action L1 Hyperliquid via EIP-712.
 * Le wallet signe un "phantom agent" (source + connectionId).
 * source = "b" pour testnet, "a" pour mainnet.
 */
async function signL1Action(
  signer: ethers.Signer,
  action: unknown,
  vaultAddress: string | null,
  nonce: number,
  isMainnet: boolean
): Promise<{ r: string; s: string; v: number }> {
  const hash = actionHash(action, vaultAddress, nonce);
  const phantomAgent = {
    source: isMainnet ? "a" : "b",
    connectionId: hash,
  };
  const rawSig = await (signer as any).signTypedData(
    PHANTOM_DOMAIN,
    AGENT_TYPES,
    phantomAgent
  );
  const { r, s, v } = ethers.Signature.from(rawSig);
  return { r, s, v };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function getBaseAsset(market: string): string {
  return (market ?? "").split("/")[0].trim().toUpperCase();
}

function buildDeepLink(market: string): string {
  return `${HL_TESTNET_APP}/${getBaseAsset(market)}`;
}

function formatPrice(val: unknown): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function computeRR(entry: number, sl: number, tp: number, isBuy: boolean): string {
  const risk = isBuy ? entry - sl : sl - entry;
  const reward = isBuy ? tp - entry : entry - tp;
  if (risk <= 0 || reward <= 0) return "—";
  return `1 : ${(reward / risk).toFixed(2)}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface HyperliquidTradeSheetProps {
  payload: Record<string, unknown>;
  signalId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HyperliquidTradeSheet({ payload, signalId }: HyperliquidTradeSheetProps) {
  const { address } = useEvmWallet();
  const [open, setOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // ── Extraire les champs du payload décrypté ────────────────────────────────
  const market = String(payload.market ?? "");
  const sideLabel = String(
    payload.sideLabel ?? (payload.side === 0 ? "Long" : "Short")
  );
  const isBuy =
    payload.side === 0 ||
    String(payload.sideLabel ?? "").toLowerCase() === "long";
  const entryKindLabel = String(
    payload.entryKindLabel ?? (payload.entryKind === 0 ? "Market" : "Limit")
  );
  const isMarket =
    payload.entryKind === 0 ||
    String(payload.entryKindLabel ?? "").toLowerCase() === "market";

  const entryPrice = Number(payload.entryPrice ?? payload.entry ?? 0);
  const stopLoss = Number(payload.stopLoss ?? payload.stop ?? 0);
  const takeProfitPrice = Number(
    payload.takeProfitPrice ?? payload.takeProfit ?? 0
  );
  const takeProfitSize = Number(payload.takeProfitSize ?? 100);
  const sizeUsd = Number(payload.sizeUsd ?? 0);
  const leverage = Number(payload.leverage ?? 1);

  const baseAsset = getBaseAsset(market);
  const assetIndex = HL_ASSET_INDEX[baseAsset] ?? null;
  const deepLink = buildDeepLink(market);

  // Taille en unités de l'asset : sizeUsd / entryPrice
  const size = entryPrice > 0 ? sizeUsd / entryPrice : 0;
  const rrRatio = computeRR(entryPrice, stopLoss, takeProfitPrice, isBuy);
  const slPct =
    entryPrice > 0
      ? ((Math.abs(entryPrice - stopLoss) / entryPrice) * 100).toFixed(2)
      : "—";
  const tpPct =
    entryPrice > 0
      ? ((Math.abs(takeProfitPrice - entryPrice) / entryPrice) * 100).toFixed(2)
      : "—";

  // ── Exécution de l'ordre ───────────────────────────────────────────────────
  async function executeOrder() {
    setTxError(null);
    setTxResult(null);

    if (!address) {
      setTxError("Connecte ton wallet d'abord.");
      return;
    }
    if (assetIndex === null) {
      setTxError(
        `L'asset "${baseAsset}" n'est pas encore supporté. Utilise le deep link.`
      );
      return;
    }
    if (!window.ethereum) {
      setTxError("Aucun provider EVM détecté dans le navigateur.");
      return;
    }

    setExecuting(true);
    try {
      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      const nonce = Date.now();

      // Prix en string sans trailing zeros
      const priceStr = isMarket ? "0" : floatToWire(entryPrice);
      const sizeStr = floatToWire(size);

      // Construction de l'ordre au format wire HL
      const orderWire = {
        a: assetIndex,        // asset index
        b: isBuy,             // isBuy
        p: priceStr,          // limitPx (string)
        s: sizeStr,           // size (string)
        r: false,             // reduceOnly
        t: isMarket
          ? { market: { tif: "Ioc" } }
          : { limit: { tif: "Gtc" } },
      };

      // Action à signer + envoyer
      const action = {
        type: "order",
        orders: [orderWire],
        grouping: "na",
      };

      // Signature L1 Hyperliquid (phantom agent EIP-712)
      // isMainnet = false → source = "b" (testnet)
      const sig = await signL1Action(
        signer,
        action,
        null,          // pas de vault address : null → flag 0x00
        nonce,
        false          // testnet
      );

      // Payload final vers l'API HL testnet
      const hlPayload = {
        action,
        nonce,
        signature: sig,
      };

      const resp = await fetch(HL_TESTNET_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hlPayload),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(
          data?.response ?? data?.error ?? `HTTP ${resp.status}`
        );
      }

      // Réponse HL : { status: "ok", response: { type: "order", data: { statuses: [...] } } }
      if (data?.status !== "ok") {
        throw new Error(
          data?.response ?? JSON.stringify(data) ?? "HL API error"
        );
      }

      const statuses: any[] = data?.response?.data?.statuses ?? [];
      const firstStatus = statuses[0];

      if (firstStatus?.error) {
        throw new Error(firstStatus.error);
      }

      const oid =
        firstStatus?.resting?.oid ??
        firstStatus?.filled?.oid ??
        "unknown";

      setTxResult(
        `Ordre soumis sur Hyperliquid Testnet — oid: ${oid}`
      );
    } catch (e: any) {
      setTxError(e?.shortMessage ?? e?.message ?? "Ordre échoué");
    } finally {
      setExecuting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTxResult(null);
          setTxError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!market || assetIndex === null}
          title={
            assetIndex === null
              ? `"${baseAsset}" non supporté pour l'exécution directe`
              : `Trader ${market} sur Hyperliquid Testnet`
          }
        >
          <Zap className="h-4 w-4" />
          Trade on Hyperliquid (testnet)
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-white/10 bg-slate-950 sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle className="font-display text-xl text-white">
            Execute on Hyperliquid
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-slate-400">Signal #{signalId}</span>
            <Badge
              className={
                isBuy
                  ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-200"
                  : "border-rose-300/30 bg-rose-500/20 text-rose-200"
              }
            >
              {market} — {sideLabel}
            </Badge>
            <Badge variant="outline" className="border-white/15 text-slate-300">
              {entryKindLabel}
            </Badge>
            <Badge className="border-amber-300/30 bg-amber-500/20 text-amber-200">
              TESTNET
            </Badge>
          </SheetDescription>
        </SheetHeader>

        {/* ── Récap du trade ── */}
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Entry", value: formatPrice(entryPrice), mono: true },
              { label: "Leverage", value: `${leverage}×`, mono: true },
              {
                label: "Stop Loss",
                value: `${formatPrice(stopLoss)} (−${slPct}%)`,
                mono: true,
                className: "text-rose-300",
              },
              {
                label: "Take Profit",
                value: `${formatPrice(takeProfitPrice)} (+${tpPct}%)`,
                mono: true,
                className: "text-emerald-300",
              },
              { label: "TP Size", value: `${takeProfitSize}%`, mono: false },
              { label: "Risk / Reward", value: rrRatio, mono: false },
              {
                label: "Size USD",
                value: `$${formatPrice(sizeUsd)}`,
                mono: true,
              },
              {
                label: "Size (asset)",
                value: `${size > 0 ? size.toFixed(6) : "—"} ${baseAsset}`,
                mono: true,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="rounded-md border border-white/10 bg-slate-900/80 p-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  {row.label}
                </p>
                <p
                  className={`text-xs ${row.mono ? "font-mono" : ""} ${
                    row.className ?? "text-slate-100"
                  }`}
                >
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {/* Warning Market order */}
          {isMarket && (
            <div className="flex gap-2 rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Les ordres Market s&apos;exécutent immédiatement au meilleur prix
                disponible. Le fill peut différer du prix d&apos;entrée du signal.
              </span>
            </div>
          )}

          {/* Warning asset non mappé */}
          {assetIndex === null && (
            <div className="flex gap-2 rounded-md border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>
                L&apos;asset{" "}
                <span className="font-mono font-bold">{baseAsset}</span> n&apos;est
                pas encore mappé vers un index Hyperliquid. Utilise le deep
                link pour trader manuellement.
              </span>
            </div>
          )}

          {/* Résultat */}
          {txResult && (
            <div className="rounded-md border border-emerald-300/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
              {txResult}
            </div>
          )}

          {/* Erreur */}
          {txError && (
            <div className="rounded-md border border-rose-300/30 bg-rose-500/10 p-3 text-xs text-rose-100">
              {txError}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <SheetFooter className="flex-col gap-2 border-t border-white/10 pt-4 sm:flex-col">
          <Button
            variant="outline"
            className="w-full border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            onClick={() => window.open(deepLink, "_blank", "noopener")}
          >
            <ExternalLink className="h-4 w-4" />
            Open on Hyperliquid Testnet
          </Button>

          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            disabled={executing || !address || assetIndex === null}
            onClick={executeOrder}
          >
            <Zap className="h-4 w-4" />
            {executing ? "Signature & envoi..." : "Execute order"}
          </Button>

          {!address && (
            <p className="text-center text-xs text-slate-400">
              Connecte ton wallet pour exécuter.
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
