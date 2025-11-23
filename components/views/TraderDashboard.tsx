"use client";
import React, { useEffect, useState } from 'react';
import { Views } from '@/types';
import { Button, Card } from '@/components/ui';
import { ExternalLink, Lock, UploadCloud } from 'lucide-react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_PACKAGE_ID } from '@/lib/sui';
import { sealEncrypt } from '@/lib/seal';
import { uploadWalrusBlob } from '@/lib/walrus';

export const TraderDashboard: React.FC<{ onNavigate: (view: Views) => void }> = ({ onNavigate }) => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [pair, setPair] = useState<string>('SUI / USDC');
  const [positionType, setPositionType] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState<string>(''); // requis
  const [stopLoss, setStopLoss] = useState<string>(''); // requis
  const [takeProfit, setTakeProfit] = useState<string>(''); // requis
  const [leverage, setLeverage] = useState<string>(''); // vide -> 0
  const [sizeType, setSizeType] = useState<'PERCENT' | 'ABSOLUTE'>('PERCENT');
  const [sizeValue, setSizeValue] = useState<string>(''); // requis
  const [validDurationMs, setValidDurationMs] = useState<string>('86400000'); // +1 jour
  const [customDuration, setCustomDuration] = useState<string>('');
  const [thesis, setThesis] = useState<string>('');
  const [traderCapId, setTraderCapId] = useState<string | null>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [registerPriceSui, setRegisterPriceSui] = useState<string>('0.001');
  const [registering, setRegistering] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function loadTraderCap() {
    if (!account?.address) return;
    setCapLoading(true);
    try {
      const caps = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${SUI_PACKAGE_ID}::types::TraderCap` },
        options: { showContent: true },
      });
      const cap = caps.data?.[0]?.data?.objectId ?? null;
      setTraderCapId(cap);
    } catch {
      setTraderCapId(null);
    } finally {
      setCapLoading(false);
    }
  }

  useEffect(() => {
    loadTraderCap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  async function registerTrader(e: React.FormEvent) {
    e.preventDefault();
    if (!account?.address) {
      setPublishError('Wallet non connecté');
      return;
    }
    setPublishError(null);
    setPublishMsg(null);
    setRegistering(true);
    try {
      const priceSuiNum = Number(registerPriceSui);
      if (!Number.isFinite(priceSuiNum) || priceSuiNum < 0) {
        throw new Error('Prix invalide');
      }
      const priceMist = BigInt(Math.round(priceSuiNum * 1_000_000_000));
      const tx = new Transaction();
      tx.moveCall({
        target: `${SUI_PACKAGE_ID}::subscription::register_trader_open`,
        arguments: [tx.pure.u64(priceMist)],
      });
      const res = await signAndExecute({ transaction: tx, options: { showEffects: true } });
      setPublishMsg(`Trader créé · tx ${res.digest}`);
      await loadTraderCap();
    } catch (err: any) {
      setPublishError(err?.message ?? 'Erreur register_trader_open');
    } finally {
      setRegistering(false);
    }
  }

  async function publishSignal(e: React.FormEvent) {
    e.preventDefault();
    if (!account?.address) {
      setPublishError('Wallet non connecté');
      return;
    }
    setPublishMsg(null);
    setPublishError(null);
    setPublishing(true);
    try {
      // Utilise la TraderCap détectée
      if (!traderCapId) throw new Error('Aucune TraderCap trouvée. Enregistrez-vous via register_trader_open.');
      const duration = validDurationMs === 'custom' ? Number(customDuration || 0) : Number(validDurationMs);
      const vu = BigInt(Date.now() + (Number.isFinite(duration) ? duration : 0));

      // Construire le payload JSON à chiffrer
      const entry = Number(entryPrice);
      const sl = Number(stopLoss);
      const tp = Number(takeProfit);
      const lev = leverage === '' ? 0 : Number(leverage);
      const szVal = Number(sizeValue);

      if (!Number.isFinite(entry) || entry <= 0) throw new Error('Entry price invalide');
      if (!Number.isFinite(sl) || sl <= 0) throw new Error('Stop loss invalide');
      if (!Number.isFinite(tp) || tp <= 0) throw new Error('Take profit invalide');
      if (!Number.isFinite(szVal) || szVal <= 0) throw new Error('Size value invalide');
      if (!Number.isFinite(lev) || lev < 0) throw new Error('Leverage invalide');
      const side = positionType === 'LONG' ? 'BUY' : 'SELL';
      const payload = {
        market: pair.replace(/\s+/g, ''), // ex: "SUI/USDC"
        side, // BUY/SELL
        position_type: positionType, // LONG/SHORT
        entry_type: 'MARKET',
        entry_price: entry,
        stop_loss: sl,
        take_profit: tp,
        leverage: lev,
        size_type: sizeType,
        size_value: szVal,
        slippage_bps: 50,
        valid_until: new Date(Number(vu)).toISOString(),
        note: thesis || 'Encrypted thesis',
      };

      // 1) Chiffre avec Seal
      const { encryptedBytes } = await sealEncrypt(payload, 2);
      // 2) Upload Walrus
      const upload = await uploadWalrusBlob(encryptedBytes);
      const blobId =
        upload.newlyCreated?.blobObject?.blobId ||
        upload.alreadyCertified?.blobId ||
        (() => {
          throw new Error('Walrus blobId introuvable');
        })();
      const walrusUriStr = `walrus://${blobId}`;

      // 3) Publie on-chain
      const tx = new Transaction();
      tx.moveCall({
        target: `${SUI_PACKAGE_ID}::signal_registry::publish_signal`,
        arguments: [
          tx.object(traderCapId),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(walrusUriStr))),
          tx.pure.u64(vu),
          tx.object('0x6'), // Clock
        ],
      });
      const res = await signAndExecute({
        transaction: tx,
        options: { showEffects: true },
      });
      setPublishMsg(`Signal publié. Walrus=${walrusUriStr} Tx=${res.digest}`);
    } catch (err: any) {
      setPublishError(err?.message ?? 'Erreur publish');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-12">
        <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 tracking-tighter">Creator Studio</h2>
        <p className="text-slate-400 text-lg max-w-2xl leading-relaxed opacity-80">Publish encrypted signals to the protocol.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Publish Form */}
        <div className="lg:col-span-2">
           <Card className="p-8 border-violet-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                 <Lock className="w-32 h-32 text-violet-500" />
              </div>
              
              <div className="relative z-10">
                 <h3 className="text-xl font-bold text-white font-display mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-400"><UploadCloud className="w-4 h-4" /></div>
                    New Signal
                 </h3>

                 <form className="space-y-6" onSubmit={publishSignal}>
                    {!traderCapId && (
                      <div className="border border-amber-400/40 bg-amber-500/5 rounded-lg p-4 space-y-3">
                        <div className="text-amber-300 text-sm font-mono">Aucune TraderCap trouvée. Enregistrez-vous via register_trader_open.</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-2">Prix abonnement (SUI)</label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={registerPriceSui}
                              onChange={(e) => setRegisterPriceSui(e.target.value)}
                              className="w-full bg-black border border-amber-400/40 rounded px-3 py-2 text-amber-100 font-mono text-sm focus:border-amber-300 outline-none"
                            />
                          </div>
                          <div className="flex items-end">
                            <Button type="button" variant="primary" fullWidth disabled={registering} onClick={registerTrader}>
                              {registering ? 'Création...' : 'Créer profil trader'}
                            </Button>
                          </div>
                        </div>
                        <div className="text-[11px] text-amber-200 font-mono">Cette action écrit on-chain (testnet) et crée ta TraderCap + TraderProfile.</div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pair</label>
                          <select
                            value={pair}
                            onChange={(e) => setPair(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white text-sm focus:border-violet-500 outline-none appearance-none font-mono"
                          >
                             <option value="SUI / USDC">SUI / USDC</option>
                             <option value="CETUS / SUI">CETUS / SUI</option>
                             <option value="NAVX / SUI">NAVX / SUI</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Side</label>
                          <div className="flex gap-2">
                             <button
                               type="button"
                               onClick={() => setPositionType('LONG')}
                               className={`flex-1 py-3 text-xs font-bold tracking-wider rounded transition-colors ${
                                 positionType === 'LONG'
                                   ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                   : 'bg-transparent border border-white/10 text-slate-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300'
                               }`}
                             >
                               LONG
                             </button>
                             <button
                               type="button"
                               onClick={() => setPositionType('SHORT')}
                               className={`flex-1 py-3 text-xs font-bold tracking-wider rounded transition-colors ${
                                 positionType === 'SHORT'
                                   ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                   : 'bg-transparent border border-white/10 text-slate-500 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                               }`}
                             >
                               SHORT
                             </button>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Entry</label>
                          <input
                            type="number"
                            value={entryPrice}
                            onChange={(e) => setEntryPrice(e.target.value)}
                            placeholder="e.g. 1.234"
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Stop</label>
                          <input
                            type="number"
                            value={stopLoss}
                            onChange={(e) => setStopLoss(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Target</label>
                          <input
                            type="number"
                            value={takeProfit}
                            onChange={(e) => setTakeProfit(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Leverage</label>
                          <input
                            type="number"
                            value={leverage}
                            onChange={(e) => setLeverage(e.target.value)}
                            placeholder="5"
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                          />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Size Type</label>
                          <select
                            value={sizeType}
                            onChange={(e) => setSizeType(e.target.value as 'PERCENT' | 'ABSOLUTE')}
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white text-sm focus:border-violet-500 outline-none appearance-none font-mono"
                          >
                             <option value="PERCENT">PERCENT</option>
                             <option value="ABSOLUTE">ABSOLUTE</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Size Value</label>
                          <input
                            type="number"
                            value={sizeValue}
                            onChange={(e) => setSizeValue(e.target.value)}
                            placeholder="2"
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Validité</label>
                          <select
                            value={validDurationMs}
                            onChange={(e) => setValidDurationMs(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white text-sm focus:border-violet-500 outline-none appearance-none font-mono"
                          >
                            <option value="3600000">+1 heure</option>
                            <option value="86400000">+1 jour</option>
                            <option value="259200000">+3 jours</option>
                            <option value="604800000">+7 jours</option>
                            <option value="2592000000">+30 jours</option>
                            <option value="custom">Durée personnalisée (ms)</option>
                          </select>
                       </div>
                       {validDurationMs === 'custom' && (
                         <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Durée personnalisée (ms)</label>
                            <input
                              type="number"
                              value={customDuration}
                              onChange={(e) => setCustomDuration(e.target.value)}
                              placeholder="ex: 3600000 pour 1h"
                              className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none"
                            />
                         </div>
                       )}
                    </div>

                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Thesis (Encrypted)</label>
                       <textarea 
                          className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none min-h-[100px]"
                          placeholder="// Explain your thesis here..."
                          value={thesis}
                          onChange={(e) => setThesis(e.target.value)}
                       ></textarea>
                    </div>

                    {publishError && <div className="text-red-400 text-xs font-mono">{publishError}</div>}
                    {publishMsg && <div className="text-emerald-400 text-xs font-mono">{publishMsg}</div>}

                    <div className="pt-4">
                       <Button variant="primary" size="lg" fullWidth type="submit" disabled={publishing}>
                          {publishing ? 'Publishing...' : 'PUBLISH SIGNAL'}
                       </Button>
                    </div>
                 </form>
              </div>
           </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           <Card className="p-6 bg-white/5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Revenue (30d)</h3>
              <div className="text-3xl font-mono font-bold text-white mb-1">2,450 SUI</div>
              <div className="text-xs text-emerald-400 mb-6 font-mono">+12.5% vs last month</div>
              
              <div className="space-y-4 border-t border-white/5 pt-4">
                 {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center">
                       <div>
                          <div className="text-white font-bold font-mono text-xs">142.5 SUI</div>
                          <div className="text-[10px] text-slate-500 uppercase">Subscription Payout</div>
                       </div>
                       <ExternalLink className="w-3 h-3 text-slate-600 hover:text-white cursor-pointer" />
                    </div>
                 ))}
              </div>
           </Card>
        </div>

      </div>
    </div>
  );
};
