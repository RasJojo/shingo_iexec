"use client";

/**
 * HyperliquidTradeSheet — Click to Trade vers Hyperliquid Testnet
 *
 * Pattern agent wallet (officiel HL) :
 *   1. Génère un agent wallet éphémère (Wallet.createRandom, stocké en sessionStorage)
 *   2. MetaMask signe approveAgent via signUserSignedAction (chainId Arbitrum Sepolia 421614)
 *   3. L'agent wallet signe les L1 actions (chainId 1337) — pas de conflit MetaMask
 *
 * Pourquoi ce pattern ?
 *   MetaMask refuse eth_signTypedData_v4 quand le domain chainId (1337) ≠ réseau actif.
 *   L'agent wallet est une clé privée locale qui signe directement sans passer par MetaMask.
 */

import React, { useState } from "react";
import { encode } from "@msgpack/msgpack";
import { BrowserProvider, ethers, getBytes, HDNodeWallet, keccak256, Wallet } from "ethers";
import { AlertTriangle, ExternalLink, KeyRound, Zap } from "lucide-react";
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
const AGENT_SESSION_KEY = "hl_agent_pk";

// Domain pour les L1 actions (phantom agent) — chainId toujours 1337
const PHANTOM_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

// Domain pour approveAgent — chainId Arbitrum Sepolia (wallet de l'utilisateur)
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const APPROVE_AGENT_DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

// Types EIP-712
const AGENT_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
};

const APPROVE_AGENT_TYPES = {
  "HyperliquidTransaction:ApproveAgent": [
    { name: "hyperliquidChain", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "agentName", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
};

// ─── Asset index map (Hyperliquid TESTNET) ────────────────────────────────────
// Index récupérés via POST /info {"type":"meta"} sur api.hyperliquid-testnet.xyz
// ⚠️  Ces index diffèrent du mainnet — à mettre à jour si le testnet change
const HL_ASSET_INDEX: Record<string, number> = {
  SOL: 0,
  BTC: 3,
  ETH: 4,
  MATIC: 5,
  BNB: 6,
  AVAX: 7,
  OP: 11,
  ARB: 13,
  SUI: 25,
  DOGE: 173,
};

// Taille minimum par asset sur Hyperliquid testnet (en unités de l'asset)
const HL_MIN_SIZE: Record<string, number> = {
  BTC: 0.001,
  ETH: 0.01,
  SOL: 0.1,
  ARB: 10,
  AVAX: 0.1,
  BNB: 0.01,
  MATIC: 10,
  OP: 1,
  DOGE: 100,
  SUI: 1,
};

// ─── Signing helpers ───────────────────────────────────────────────────────────

function removeTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  const normalized = value.replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

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

function floatToWire(x: number): string {
  const rounded = x.toFixed(8);
  const normalized = rounded.replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

/**
 * actionHash = keccak256( msgpack(action) + nonce(8B BE) + vaultFlag(1B) )
 */
function actionHash(action: unknown, vaultAddress: string | null, nonce: number): string {
  const normalized = normalizeAction(action);
  const msgPackBytes = encode(normalized);
  const additionalBytes = vaultAddress === null ? 9 : 29;
  const data = new Uint8Array(msgPackBytes.length + additionalBytes);
  data.set(msgPackBytes);
  const view = new DataView(data.buffer);
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
 * Signe une L1 action avec l'agent wallet (Wallet ethers — pas MetaMask).
 * source = "b" pour testnet.
 */
async function signL1ActionWithAgent(
  agentWallet: Wallet | HDNodeWallet,
  action: unknown,
  vaultAddress: string | null,
  nonce: number,
  isMainnet: boolean
): Promise<{ r: string; s: string; v: number }> {
  const hash = actionHash(action, vaultAddress, nonce);
  const phantomAgent = { source: isMainnet ? "a" : "b", connectionId: hash };
  const rawSig = await agentWallet.signTypedData(PHANTOM_DOMAIN, AGENT_TYPES, phantomAgent);
  const { r, s, v } = ethers.Signature.from(rawSig);
  return { r, s, v };
}

/**
 * Signe approveAgent avec MetaMask (chainId Arbitrum Sepolia — pas de conflit).
 *
 * Portage exact du SDK Python sign_user_signed_action :
 * - signatureChainId et hyperliquidChain sont injectés dans le message
 * - Le même objet est signé ET envoyé à l'API (pas deux objets distincts)
 */
async function signAndBuildApproveAgent(
  provider: BrowserProvider,
  signerAddress: string,
  agentAddress: string,
  agentName: string,
  nonce: number,
  isMainnet: boolean
): Promise<{ action: Record<string, unknown>; sig: { r: string; s: string; v: number } }> {
  // Construit l'action — même objet utilisé pour la signature ET l'envoi API
  const action: Record<string, unknown> = {
    type: "approveAgent",
    hyperliquidChain: isMainnet ? "Mainnet" : "Testnet",
    signatureChainId: "0x66eee", // Arbitrum Sepolia hex — toujours 0x66eee (testnet et mainnet)
    agentAddress: agentAddress.toLowerCase(),
    agentName,
    nonce,
  };

  // Message EIP-712 = l'action complète (avec signatureChainId et hyperliquidChain)
  const typedData = JSON.stringify({
    domain: APPROVE_AGENT_DOMAIN,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      "HyperliquidTransaction:ApproveAgent": [
        { name: "hyperliquidChain", type: "string" },
        { name: "agentAddress", type: "address" },
        { name: "agentName", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: action.hyperliquidChain,
      agentAddress: action.agentAddress,
      agentName: action.agentName,
      nonce: action.nonce,
    },
  });

  const rawSig = await provider.send("eth_signTypedData_v4", [
    signerAddress.toLowerCase(),
    typedData,
  ]);
  const { r, s, v } = ethers.Signature.from(rawSig);
  return { action, sig: { r, s, v } };
}

/**
 * Envoie une action à l'API HL testnet.
 */
async function sendToHL(payload: unknown): Promise<any> {
  const resp = await fetch(HL_TESTNET_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.response ?? data?.error ?? `HTTP ${resp.status}`);
  if (data?.status !== "ok") throw new Error(typeof data?.response === "string" ? data.response : JSON.stringify(data));
  return data;
}

// ─── Agent wallet helpers ─────────────────────────────────────────────────────

function loadOrCreateAgent(): Wallet | HDNodeWallet {
  const stored = sessionStorage.getItem(AGENT_SESSION_KEY);
  if (stored) return new Wallet(stored);
  const fresh = Wallet.createRandom();
  sessionStorage.setItem(AGENT_SESSION_KEY, fresh.privateKey);
  return fresh;
}

function clearAgent() {
  sessionStorage.removeItem(AGENT_SESSION_KEY);
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
  const [step, setStep] = useState<"idle" | "approving" | "trading">("idle");
  const [agentApproved, setAgentApproved] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [forceMarket, setForceMarket] = useState(false);

  // ── Payload fields ─────────────────────────────────────────────────────────
  const market = String(payload.market ?? "");
  const sideLabel = String(payload.sideLabel ?? (payload.side === 0 ? "Long" : "Short"));
  const isBuy = payload.side === 0 || String(payload.sideLabel ?? "").toLowerCase() === "long";
  const entryKindLabel = String(payload.entryKindLabel ?? (payload.entryKind === 0 ? "Market" : "Limit"));
  const isMarket = payload.entryKind === 0 || String(payload.entryKindLabel ?? "").toLowerCase() === "market";
  const entryPrice = Number(payload.entryPrice ?? payload.entry ?? 0);
  const stopLoss = Number(payload.stopLoss ?? payload.stop ?? 0);
  const takeProfitPrice = Number(payload.takeProfitPrice ?? payload.takeProfit ?? 0);
  const takeProfitSize = Number(payload.takeProfitSize ?? 100);
  const sizeUsd = Number(payload.sizeUsd ?? 0);
  const leverage = Number(payload.leverage ?? 1);
  const baseAsset = getBaseAsset(market);
  const assetIndex = HL_ASSET_INDEX[baseAsset] ?? null;
  const deepLink = buildDeepLink(market);

  // Taille customisable par l'utilisateur (initialisée avec la valeur du signal)
  const [customSizeUsd, setCustomSizeUsd] = useState<string>(sizeUsd > 0 ? String(sizeUsd) : "");

  const effectiveSizeUsd = Number(customSizeUsd) > 0 ? Number(customSizeUsd) : sizeUsd;
  const size = entryPrice > 0 ? effectiveSizeUsd / entryPrice : 0;
  const minSize = HL_MIN_SIZE[baseAsset] ?? null;
  const minSizeUsd = minSize !== null && entryPrice > 0 ? minSize * entryPrice : null;
  const isBelowMinSize = minSize !== null && size > 0 && size < minSize;
  const rrRatio = computeRR(entryPrice, stopLoss, takeProfitPrice, isBuy);
  const slPct = entryPrice > 0 ? ((Math.abs(entryPrice - stopLoss) / entryPrice) * 100).toFixed(2) : "—";
  const tpPct = entryPrice > 0 ? ((Math.abs(takeProfitPrice - entryPrice) / entryPrice) * 100).toFixed(2) : "—";

  function resetState() {
    setStep("idle");
    setTxResult(null);
    setTxError(null);
  }

  // ── Étape 1 : approuver l'agent wallet via MetaMask ────────────────────────
  async function handleApproveAgent() {
    if (!address || !window.ethereum) return;
    setStep("approving");
    setTxError(null);
    setTxResult(null);
    try {
      const provider = new BrowserProvider(window.ethereum as any);
      const agent = loadOrCreateAgent();
      const nonce = Date.now();

      const { action, sig } = await signAndBuildApproveAgent(provider, address, agent.address, "shingo", nonce, false);

      await sendToHL({ action, nonce, signature: sig, vaultAddress: null });
      setAgentApproved(true);
      setTxResult(`Agent approuvé : ${agent.address.slice(0, 10)}...`);
    } catch (e: any) {
      setTxError(e?.shortMessage ?? e?.message ?? "Approbation agent échouée");
      clearAgent();
    } finally {
      setStep("idle");
    }
  }

  // ── Étape 2 : placer l'ordre avec l'agent wallet ───────────────────────────
  async function handleExecuteOrder() {
    if (!address) { setTxError("Connecte ton wallet."); return; }
    if (assetIndex === null) { setTxError(`"${baseAsset}" non supporté.`); return; }
    if (!agentApproved) { setTxError("Approuve l'agent wallet d'abord."); return; }
    if (isBelowMinSize && minSize !== null) {
      const minUsd = minSizeUsd !== null ? ` (~$${Math.ceil(minSizeUsd)})` : "";
      setTxError(`Taille trop petite. Minimum : ${minSize} ${baseAsset}${minUsd}.`);
      return;
    }

    setStep("trading");
    setTxError(null);
    setTxResult(null);
    try {
      const agent = loadOrCreateAgent();
      const nonce = Date.now();
      const useMarket = isMarket || forceMarket;
      const priceStr = useMarket ? "0" : floatToWire(entryPrice);
      const sizeStr = floatToWire(size);

      const orderWire = {
        a: assetIndex,
        b: isBuy,
        p: priceStr,
        s: sizeStr,
        r: false,
        t: useMarket ? { market: { tif: "Ioc" } } : { limit: { tif: "Gtc" } },
      };

      const action = { type: "order", orders: [orderWire], grouping: "na" };

      const sig = await signL1ActionWithAgent(agent, action, null, nonce, false);

      const data = await sendToHL({ action, nonce, signature: sig, vaultAddress: null });

      const statuses: any[] = data?.response?.data?.statuses ?? [];
      const first = statuses[0];
      if (first?.error) throw new Error(first.error);

      const oid = first?.resting?.oid ?? first?.filled?.oid ?? "unknown";
      setTxResult(`Ordre soumis — oid: ${oid}`);
    } catch (e: any) {
      setTxError(e?.shortMessage ?? e?.message ?? "Ordre échoué");
    } finally {
      setStep("idle");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <SheetTrigger asChild>
        <Button
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!market || assetIndex === null}
          title={assetIndex === null ? `"${baseAsset}" non supporté` : undefined}
        >
          <Zap className="h-4 w-4" />
          Trade on Hyperliquid (testnet)
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col border-l border-slate-300 dark:border-white/10 bg-slate-950 sm:max-w-md">
        <SheetHeader className="border-b border-slate-300 dark:border-white/10 pb-4">
          <SheetTitle className="font-display text-xl text-white">Execute on Hyperliquid</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-slate-400">Signal #{signalId}</span>
            <Badge className={isBuy
              ? "border-emerald-300/30 bg-emerald-500/20 text-emerald-200"
              : "border-rose-300/30 bg-rose-500/20 text-rose-200"
            }>
              {market} — {sideLabel}
            </Badge>
            <Badge variant="outline" className="border-slate-400 dark:border-white/15 text-slate-300">{entryKindLabel}</Badge>
            <Badge className="border-amber-300/30 bg-amber-500/20 text-amber-200">TESTNET</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {/* Récap du trade */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Entry", value: formatPrice(entryPrice), mono: true },
              { label: "Leverage", value: `${leverage}×`, mono: true },
              { label: "Stop Loss", value: `${formatPrice(stopLoss)} (−${slPct}%)`, mono: true, className: "text-rose-300" },
              { label: "Take Profit", value: `${formatPrice(takeProfitPrice)} (+${tpPct}%)`, mono: true, className: "text-emerald-300" },
              { label: "TP Size", value: `${takeProfitSize}%`, mono: false },
              { label: "Risk / Reward", value: rrRatio, mono: false },
              { label: "Size USD", value: `$${formatPrice(effectiveSizeUsd)}`, mono: true },
              { label: "Size (asset)", value: `${size > 0 ? size.toFixed(6) : "—"} ${baseAsset}`, mono: true },
            ].map((row) => (
              <div key={row.label} className="rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/80 p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{row.label}</p>
                <p className={`text-xs ${row.mono ? "font-mono" : ""} ${row.className ?? "text-slate-100"}`}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {/* Taille customisable */}
          <div className="rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/80 p-3 space-y-2">
            <label className="text-[10px] uppercase tracking-wide text-slate-500 block">
              Taille en USD{sizeUsd > 0 ? ` (signal : $${sizeUsd})` : ""}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={customSizeUsd}
                onChange={(e) => setCustomSizeUsd(e.target.value)}
                placeholder={sizeUsd > 0 ? String(sizeUsd) : "ex: 10"}
                className="flex-1 rounded-md border border-slate-400 dark:border-white/15 bg-white dark:bg-slate-950/80 px-3 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {sizeUsd > 0 && (
                <button
                  className="text-xs text-slate-400 hover:text-slate-200 underline whitespace-nowrap"
                  onClick={() => setCustomSizeUsd(String(sizeUsd))}
                >
                  Reset
                </button>
              )}
            </div>
            {size > 0 && (
              <p className="text-[11px] text-slate-400 font-mono dark:text-slate-400">
                ≈ {size.toFixed(6)} {baseAsset}
              </p>
            )}
            {isBelowMinSize && minSize !== null && (
              <div className="flex gap-1.5 items-start rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-200">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Taille trop petite. Minimum HL : <span className="font-mono font-semibold">{minSize} {baseAsset}</span>
                  {minSizeUsd !== null && <> (~$<span className="font-mono font-semibold">{Math.ceil(minSizeUsd)}</span>)</>}.
                  Augmente ta taille.
                </span>
              </div>
            )}
          </div>

          {/* Explication agent wallet */}
          {!agentApproved && (
            <div className="rounded-md border border-slate-700 bg-white dark:bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-slate-200 flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> 2 étapes requises
              </p>
              <p>
                <span className="text-slate-400">Étape 1 —</span> Approuver un agent wallet temporaire (signature MetaMask sur Arbitrum Sepolia).
              </p>
              <p>
                <span className="text-slate-400">Étape 2 —</span> Placer l&apos;ordre via l&apos;agent (clé locale, aucune signature MetaMask supplémentaire).
              </p>
            </div>
          )}

          {/* Toggle forcer Market si le signal est Limit */}
          {!isMarket && (
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900/60 p-3 text-xs">
              <input
                type="checkbox"
                checked={forceMarket}
                onChange={(e) => setForceMarket(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              <div>
                <p className="font-semibold text-gray-800 dark:text-slate-200">Forcer ordre Market</p>
                <p className="text-gray-600 dark:text-slate-400 mt-0.5">
                  Exécution immédiate au prix du marché — contourne l&apos;erreur &quot;price too far from reference&quot;.
                </p>
              </div>
            </label>
          )}

          {/* Market order warning */}
          {(isMarket || forceMarket) && (
            <div className="flex gap-2 rounded-md border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Les ordres Market s&apos;exécutent immédiatement au meilleur prix disponible.
                Le fill peut différer du prix d&apos;entrée du signal.
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

        <SheetFooter className="flex-col gap-2 border-t border-slate-300 dark:border-white/10 pt-4 sm:flex-col">
          <Button
            variant="outline"
            className="w-full border-slate-400 dark:border-white/15 bg-white dark:bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            onClick={() => window.open(deepLink, "_blank", "noopener")}
          >
            <ExternalLink className="h-4 w-4" />
            Open on Hyperliquid Testnet
          </Button>

          {!agentApproved ? (
            <Button
              className="w-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
              disabled={step === "approving" || !address}
              onClick={handleApproveAgent}
            >
              <KeyRound className="h-4 w-4" />
              {step === "approving" ? "Approbation en cours..." : "Étape 1 — Approuver l'agent"}
            </Button>
          ) : (
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              disabled={step === "trading" || !address || assetIndex === null || isBelowMinSize}
              onClick={handleExecuteOrder}
            >
              <Zap className="h-4 w-4" />
              {step === "trading" ? "Envoi en cours..." : "Étape 2 — Execute order"}
            </Button>
          )}

          {agentApproved && (
            <button
              className="text-center text-xs text-slate-500 hover:text-slate-300 underline"
              onClick={() => { clearAgent(); setAgentApproved(false); setTxResult(null); }}
            >
              Réinitialiser l&apos;agent
            </button>
          )}

          {!address && (
            <p className="text-center text-xs text-slate-400">Connecte ton wallet pour continuer.</p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
