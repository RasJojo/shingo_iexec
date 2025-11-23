"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Views } from '@/types';
import { TRADERS } from '@/lib/data';
import { Button, Card, Badge, Metric } from '@/components/ui';
import { ArrowLeft, ShieldCheck, ExternalLink, Share2, Zap, FileJson, LayoutDashboard, Lock } from 'lucide-react';
import { useCurrentAccount, useCurrentWallet, useSignAndExecuteTransaction, useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_PACKAGE_ID } from '@/lib/sui';
import { fetchWalrusBlob } from '@/lib/walrus';
import { buildSealApproveTx, createSealSessionKey, sealDecryptWithSession } from '@/lib/seal';

const MONTHLY_RETURNS = [
    { month: 'Jan', val: 12.4 },
    { month: 'Feb', val: -2.1 },
    { month: 'Mar', val: 8.5 },
    { month: 'Apr', val: 15.2 },
    { month: 'May', val: 3.2 },
    { month: 'Jun', val: -0.5 },
    { month: 'Jul', val: 5.4 },
    { month: 'Aug', val: 10.1 },
    { month: 'Sep', val: 4.2 },
    { month: 'Oct', val: 18.4 },
    { month: 'Nov', val: -1.2 },
    { month: 'Dec', val: 7.8 },
];

// Historique mock (données publiques, pour illustrer la perf passée)
const MOCK_HISTORY = [
  { date: '2025-10-31', market: 'SUI/USDC', side: 'SELL', entry: 1.3890, exit: 1.3415, pnl: 3.4 },
  { date: '2025-11-06', market: 'CETUS/USDC', side: 'SELL', entry: 0.0378, exit: 0.0353, pnl: 6.6 },
  { date: '2025-11-20', market: 'SUI/USDC', side: 'BUY', entry: 1.495, exit: 1.606, pnl: 7.4 },
  { date: '2025-11-22', market: 'NAVX/USDC', side: 'BUY', entry: 0.01387, exit: 0.01680, pnl: 21.1 },
  { date: '2025-11-22', market: 'NAVX/USDC', side: 'BUY', entry: 0.0207, exit: 0.01567, pnl: -24.4 },
];

export const TraderProfile: React.FC<{ onNavigate: (view: Views) => void; traderId: string | null; traderAddr: string | null; traderCapId?: string | null; traderProfileId?: string | null }> = ({ onNavigate, traderId, traderAddr, traderCapId, traderProfileId }) => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { currentWallet, currentAccount } = useCurrentWallet();
  const signPersonalMessage = useSignPersonalMessage();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [priceSui, setPriceSui] = useState('0.001');
  const [expiryDays, setExpiryDays] = useState('30');
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSuccess, setSubSuccess] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [signals, setSignals] = useState<
    { id: string; walrusUri: string; validUntil: string; decryptedJson?: string; error?: string }[]
  >([]);
  const [signalsMsg, setSignalsMsg] = useState<string | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);

  const fallback = TRADERS.find(t => t.id === traderId) || TRADERS[0];
  const trader = useMemo(() => {
    if (traderAddr) {
      return {
        ...fallback,
        handle: traderAddr,
        subscriptionPrice: Number(priceSui),
        avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${traderAddr}`,
        isVerified: true,
      };
    }
    return fallback;
  }, [traderAddr, fallback, priceSui]);

  // Charge le prix on-chain depuis le TraderProfile (shared)
  useEffect(() => {
    async function loadPrice() {
      if (!traderProfileId) return;
      setLoadingPrice(true);
      try {
        const obj = await client.getObject({ id: traderProfileId, options: { showContent: true } });
        const fields: any = (obj as any).data?.content?.fields;
        const priceMist = fields?.price_mist ? Number(fields.price_mist) : null;
        if (priceMist != null) {
          setPriceSui((priceMist / 1_000_000_000).toString());
        }
      } catch (e: any) {
        setSubError(e?.message ?? 'Erreur lecture prix on-chain');
      } finally {
        setLoadingPrice(false);
      }
    }
    loadPrice();
  }, [client, traderProfileId]);

  // Stats calculées sur l'historique mock (publique)
  const mockStats = useMemo(() => {
    if (MOCK_HISTORY.length === 0) return { winrate: 0, avgPnl: 0, equity: [] as number[], best: 0, worst: 0 };
    let wins = 0;
    let equity = 1;
    const curve: number[] = [];
    let sum = 0;
    let best = -Infinity;
    let worst = Infinity;
    MOCK_HISTORY.forEach((t) => {
      if (t.pnl > 0) wins += 1;
      sum += t.pnl;
      best = Math.max(best, t.pnl);
      worst = Math.min(worst, t.pnl);
      equity *= 1 + t.pnl / 100;
      curve.push(Number(equity.toFixed(3)));
    });
    return {
      winrate: Math.round((wins / MOCK_HISTORY.length) * 100),
      avgPnl: Number((sum / MOCK_HISTORY.length).toFixed(2)),
      equity: curve,
      best: Number(best.toFixed(2)),
      worst: Number(worst.toFixed(2)),
    };
  }, []);

  // Helper pour dessiner une courbe lissée (catmull-rom vers bezier)
  function buildSmoothPath(vals: number[], width = 260, height = 120) {
    if (vals.length === 0) return '';
    const max = Math.max(...vals, 1);
    const points = vals.map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * width;
      const y = height - (v / max) * (height - 20);
      return { x, y };
    });
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  async function subscribe() {
    if (!account?.address || !traderProfileId) {
      setSubError('Wallet non connecté ou TraderProfile inconnu');
      return;
    }
    setSubscribing(true);
    setSubError(null);
    setSubSuccess(null);
    try {
      const priceMist = BigInt(Math.floor(parseFloat(priceSui || '0') * 1_000_000_000));
      const expiresMs = BigInt(Date.now() + Number(expiryDays || '30') * 24 * 3600 * 1000);
      const coins = await client.getCoins({ owner: account.address, coinType: '0x2::sui::SUI', limit: 20 });
      const coin = coins.data.find((c) => BigInt(c.balance) >= priceMist + BigInt(1_000_000)); // marge gas
      if (!coin) {
        throw new Error('Pas de coin SUI suffisant pour payer');
      }
      const tx = new Transaction();
      tx.moveCall({
        target: `${SUI_PACKAGE_ID}::subscription::mint_subscription_public_profile`,
        arguments: [
          tx.object(traderProfileId),
          tx.pure.address(account.address),
          tx.pure.u64(expiresMs),
          tx.object('0x6'), // Clock
          tx.object(coin.coinObjectId),
        ],
      });
      const res = await signAndExecute({
        transaction: tx,
        options: { showEffects: true },
      });
      setSubSuccess(`Tx: ${res.digest}`);
    } catch (e: any) {
      setSubError(e?.message ?? 'Erreur subscription');
    } finally {
      setSubscribing(false);
    }
  }

  // Helpers pour lire les objets Sui
  function readField<T>(obj: any, path: string[]): T | undefined {
    const content: any = obj.data?.content;
    if (!content || content.dataType !== 'moveObject') return undefined;
    let cursor: any = content.fields;
    for (const p of path) cursor = cursor?.[p];
    return cursor as T | undefined;
  }
  function decodeWalrusUri(bytes: number[]): string {
    try {
      return new TextDecoder().decode(new Uint8Array(bytes));
    } catch {
      return '';
    }
  }

  // Chargement des signaux désactivé pour éviter les pop-ups de signature dès l'ouverture du profil.
  // On réactivera sur action explicite (bouton) si besoin.

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Nav */}
      <div className="flex items-center justify-between mb-8">
         <button 
            onClick={() => onNavigate(Views.MARKETPLACE)} 
            className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-mono uppercase"
         >
            <div className="p-1 rounded border border-white/10 group-hover:border-white/30"><ArrowLeft className="w-3 h-3" /></div>
            Back to Marketplace
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Identity & Sub */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-0 overflow-hidden">
             {/* Cover */}
             <div className={`h-24 relative ${trader.pnl30d > 0 ? 'bg-gradient-to-r from-cyan-900/20 to-emerald-900/20' : 'bg-gradient-to-r from-red-900/20 to-orange-900/20'}`}>
                <div className="absolute inset-0 bg-grid-pattern opacity-50"></div>
             </div>
             
             <div className="px-6 pb-6 -mt-10">
                <div className="w-20 h-20 bg-black rounded-xl overflow-hidden border-2 border-white/10 mb-4 shadow-2xl">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={trader.avatar} className="w-full h-full object-cover opacity-90" alt="Avatar"/>
                </div>
                
                <div className="flex justify-between items-start mb-4">
                   <div>
                     <h1 className="text-2xl font-display font-bold text-white tracking-tight">{trader.handle}</h1>
                     <div className="flex items-center gap-2 mt-1 text-cyan-400 text-xs font-mono uppercase tracking-wider">
                       {trader.isVerified && <><ShieldCheck className="w-3 h-3" /> Verified Strategy</>}
                     </div>
                   </div>
                </div>

                <div className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-6">
                  Profil on-chain – données détaillées à venir
                </div>

                <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-bold text-white">Monthly Access</span>
                      <span className="text-lg font-mono text-cyan-400 font-bold">{priceSui || '1'} SUI</span>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <div>
                       <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Price (SUI, on-chain)</label>
                       <input
                         value={loadingPrice ? '...' : priceSui}
                         readOnly
                         className="w-full bg-black border border-white/10 rounded px-3 py-2 text-sm text-white font-mono opacity-70"
                       />
                     </div>
                     <div>
                       <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Expiry (days)</label>
                       <input
                         value={expiryDays}
                         onChange={(e) => setExpiryDays(e.target.value)}
                         className="w-full bg-black border border-white/10 rounded px-3 py-2 text-sm text-white font-mono"
                       />
                     </div>
                   </div>

                   {subError && <div className="text-red-400 text-xs font-mono mb-2">{subError}</div>}
                   {subSuccess && <div className="text-emerald-400 text-xs font-mono mb-2">{subSuccess}</div>}

                   <Button
                     fullWidth
                     variant="primary"
                     className="justify-between group mb-4"
                     onClick={subscribe}
                     disabled={subscribing || !account}
                   >
                      <span className="font-bold">{subscribing ? 'Subscribing...' : 'SUBSCRIBE NOW'}</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                   </Button>
                   <div className="flex justify-center gap-6 border-t border-white/10 pt-3 opacity-60">
                      <div className="flex flex-col items-center gap-1" title="Real-time Signals">
                         <Zap className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="flex flex-col items-center gap-1" title="JSON API">
                         <FileJson className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="flex flex-col items-center gap-1" title="DEX Execution">
                         <LayoutDashboard className="w-4 h-4 text-slate-300" />
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button fullWidth variant="outline" size="sm" icon={<ExternalLink className="w-3 h-3"/>}>SCAN</Button>
                    <Button fullWidth variant="outline" size="sm" icon={<Share2 className="w-3 h-3"/>}>SHARE</Button>
                </div>
             </div>
          </Card>

        </div>

        {/* Right Col: on-chain reminders */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-8 border border-white/10 bg-white/5">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">Performance mock (courbe)</h3>
            <div className="space-y-3">
              <div className="flex gap-4 text-xs font-mono text-slate-400">
                <span>Winrate: <span className="text-emerald-400">{mockStats.winrate}%</span></span>
                <span>Avg PnL: <span className={mockStats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{mockStats.avgPnl}%</span></span>
                <span>Equity finale: <span className="text-cyan-400">{mockStats.equity.slice(-1)[0] ?? 1}x</span></span>
              </div>
              {/* Courbe lissée + zone, inspirée du rendu mock initial */}
              <div className="relative w-full h-32">
                <svg viewBox="0 0 260 120" className="absolute inset-0">
                  <defs>
                    <linearGradient id="gradEquity" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="260" height="120" fill="url(#gradEquity)" opacity="0.05" />
                  <path
                    d={`${buildSmoothPath(mockStats.equity, 260, 120)} L 260 120 L 0 120 Z`}
                    fill="url(#gradEquity)"
                    opacity="0.4"
                  />
                  <path
                    d={buildSmoothPath(mockStats.equity, 260, 120)}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                  />
                  {mockStats.equity.map((v, i) => {
                    const x = (i / Math.max(mockStats.equity.length - 1, 1)) * 260;
                    const max = Math.max(...mockStats.equity, 1);
                    const y = 120 - (v / max) * 100;
                    return (
                      <circle key={i} cx={x} cy={y} r={2.5} fill="#22d3ee" opacity="0.8" />
                    );
                  })}
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-8 border border-white/10 bg-white/5">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-3">Données réelles</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Seules les informations on-chain sont affichées pour l’instant : adresse du trader, formulaire de souscription.
              Les métriques de performance, l’historique des signaux et les stats agrégées seront affichés quand le backend
              (indexation + DB) sera branché.
            </p>
          </Card>

          <Card className="p-8 border border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest">Historique public (mock)</h3>
              <div className="flex gap-3 text-xs font-mono text-slate-400">
                <span>Winrate: <span className="text-emerald-400">{mockStats.winrate}%</span></span>
                <span>Avg PnL: <span className={mockStats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{mockStats.avgPnl}%</span></span>
                <span>Equity: <span className="text-cyan-400">{mockStats.equity.slice(-1)[0] ?? 1}x</span></span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Trades</div>
                <div className="text-xl font-mono text-white">{MOCK_HISTORY.length}</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Winrate</div>
                <div className="text-xl font-mono text-emerald-400">{mockStats.winrate}%</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Best trade</div>
                <div className="text-xl font-mono text-emerald-400">{mockStats.best}%</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Worst trade</div>
                <div className="text-xl font-mono text-red-400">{mockStats.worst}%</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs font-mono text-slate-300">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 uppercase">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Pair</th>
                    <th className="py-2 pr-3">Side</th>
                    <th className="py-2 pr-3">Entry</th>
                    <th className="py-2 pr-3">Exit</th>
                    <th className="py-2 pr-3">PnL %</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_HISTORY.map((t) => (
                    <tr key={`${t.date}-${t.market}-${t.entry}`} className="border-b border-white/5">
                      <td className="py-2 pr-3">{t.date}</td>
                      <td className="py-2 pr-3">{t.market}</td>
                      <td className="py-2 pr-3">{t.side}</td>
                      <td className="py-2 pr-3">{t.entry}</td>
                      <td className="py-2 pr-3">{t.exit}</td>
                      <td className={`py-2 pr-3 ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.pnl}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
