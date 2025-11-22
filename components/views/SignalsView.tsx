import React, { useEffect, useMemo, useState } from 'react';
import { Views } from '@/types';
import { Button } from '@/components/ui';
import { ArrowLeft, Lock, Copy, Terminal as TerminalIcon } from 'lucide-react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { SUI_PACKAGE_ID } from '@/lib/sui';
import { SuiObjectResponse } from '@mysten/sui/client';

type OnchainSignal = {
  id: string;
  walrusUri: string;
  validUntil: string;
};

type PassInfo = {
  id: string;
  trader: string;
  subscriber: string;
  expiresAt: string;
};

function decodeWalrusUri(bytes: number[]): string {
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

function readField<T>(obj: SuiObjectResponse, path: string[]): T | undefined {
  const content: any = obj.data?.content;
  if (!content || content.dataType !== 'moveObject') return undefined;
  let cursor: any = content.fields;
  for (const p of path) {
    cursor = cursor?.[p];
  }
  return cursor as T | undefined;
}

export const SignalsView: React.FC<{ onNavigate: (view: Views) => void; isConnected: boolean }> = ({ onNavigate, isConnected }) => {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const [traderAddress, setTraderAddress] = useState<string>(account?.address ?? '');
  const [signals, setSignals] = useState<OnchainSignal[]>([]);
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signalType = useMemo(() => `${SUI_PACKAGE_ID}::types::SignalRef`, []);
  const passType = useMemo(() => `${SUI_PACKAGE_ID}::types::SubscriptionPass`, []);

  useEffect(() => {
    if (account?.address && !traderAddress) setTraderAddress(account.address);
  }, [account?.address, traderAddress]);

  async function fetchSignalsAndPass() {
    if (!traderAddress || !account?.address) return;
    setLoading(true);
    setError(null);
    try {
      // Signals possédés par le trader ciblé
      const sigs = await client.getOwnedObjects({
        owner: traderAddress,
        filter: { StructType: signalType },
        options: { showContent: true },
      });
      const parsedSignals: OnchainSignal[] = (sigs.data || []).map((o) => {
        const id = o.data?.objectId ?? '';
        const walrus = readField<number[]>(o, ['walrus_uri']) ?? [];
        const validUntil = readField<string>(o, ['valid_until']) ?? '';
        return {
          id,
          walrusUri: decodeWalrusUri(walrus),
          validUntil: validUntil?.toString() ?? '',
        };
      });

      // Pass détenus par l’abonné (wallet connecté)
      const passes = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: passType },
        options: { showContent: true },
      });
      const matching = (passes.data || []).find((p) => readField<string>(p, ['trader']) === traderAddress);
      const pass: PassInfo | null = matching
        ? {
            id: matching.data?.objectId ?? '',
            trader: readField<string>(matching, ['trader']) ?? '',
            subscriber: readField<string>(matching, ['subscriber']) ?? '',
            expiresAt: readField<string>(matching, ['expires_at']) ?? '',
          }
        : null;

      setSignals(parsedSignals);
      setPassInfo(pass);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue lors du chargement on-chain');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConnected) fetchSignalsAndPass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, traderAddress, account?.address]);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 py-6 w-full min-h-[60vh]">
      {/* Access Denied Overlay */}
      {!isConnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-black border border-red-500/30 p-8 rounded-2xl text-center max-w-md shadow-[0_0_50px_-10px_rgba(220,38,38,0.3)]">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 animate-pulse">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white font-display mb-2">ENCRYPTED CHANNEL</h2>
            <p className="text-slate-400 text-sm font-mono mb-8">
              Connecte ton wallet et présente ton SubscriptionPass pour déchiffrer.
            </p>
            <Button variant="primary" fullWidth onClick={() => onNavigate(Views.CONNECT_WALLET)}>
              AUTHENTICATE KEY
            </Button>
          </div>
        </div>
      )}

      <div className={`transition-all duration-500 ${!isConnected ? 'blur-md pointer-events-none opacity-50 select-none' : ''}`}>
        {/* Terminal Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate(Views.DASHBOARD_SUBSCRIBER)} className="text-slate-500 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-mono font-bold text-white flex items-center gap-3 uppercase tracking-wider">
                <TerminalIcon className="w-5 h-5 text-cyan-400" />
                Terminal <span className="text-slate-600">/</span> {traderAddress || 'Trader'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">Stream Active</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Trader address</label>
            <input
              value={traderAddress}
              onChange={(e) => setTraderAddress(e.target.value.trim())}
              placeholder="0x... trader"
              className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-cyan-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={fetchSignalsAndPass} disabled={loading}>
              {loading ? 'Chargement...' : 'Sync on-chain'}
            </Button>
          </div>
        </div>

        {/* Pass info */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-mono">
          {passInfo ? (
            <>
              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SubscriptionPass OK · expires_at: {passInfo.expiresAt}
              </span>
              <span className="text-slate-500">pass id {passInfo.id}</span>
            </>
          ) : (
            <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30">
              Aucun pass pour ce trader ({traderAddress || '—'})
            </span>
          )}
          <span className="text-slate-500">Package {SUI_PACKAGE_ID}</span>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/30 rounded px-3 py-2 font-mono">
            {error}
          </div>
        )}

        {/* Signals Stream Table - Scrollable Container */}
        <div className="w-full overflow-x-auto border border-white/5 rounded-lg bg-black/20">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-white/5">
              <div className="col-span-2">Signal</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1 text-right">Blob</div>
              <div className="col-span-1 text-right">Target</div>
              <div className="col-span-1 text-right">Stop</div>
              <div className="col-span-1 text-right">Lev</div>
              <div className="col-span-1 text-right">Size</div>
              <div className="col-span-1 text-center">Slippage</div>
              <div className="col-span-2 text-center">Valid Until</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {signals.map((signal) => (
              <div key={signal.id} className="group relative bg-transparent border-b border-white/5 hover:bg-white/5 transition-all">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                  <div className="col-span-2 font-display font-bold text-white tracking-wide">Signal {signal.id.slice(0, 8)}…</div>
                  <div className="col-span-1">
                    <span className="text-xs font-bold font-mono px-2 py-1 rounded text-emerald-400 bg-emerald-500/10">
                      ACTIVE
                    </span>
                  </div>

                  <div className="col-span-1 text-xs font-mono text-slate-400">URI</div>

                  <div className="col-span-1 text-right font-mono text-white">Blob</div>
                  <div className="col-span-1 text-right font-mono text-cyan-400">n/a</div>
                  <div className="col-span-1 text-right font-mono text-slate-500">n/a</div>
                  <div className="col-span-1 text-right font-mono text-slate-300">–</div>
                  <div className="col-span-1 text-right font-mono text-slate-300">–</div>
                  <div className="col-span-1 text-center text-xs font-mono text-slate-500">–</div>
                  <div className="col-span-2 text-center text-[10px] font-mono text-slate-500">{signal.validUntil}</div>

                  <div className="col-span-2 flex justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 hover:bg-white/10 rounded border border-transparent hover:border-white/10 text-slate-400 hover:text-white"
                      onClick={() => navigator.clipboard.writeText(signal.walrusUri)}
                      title="Copier l'URI Walrus"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* URI + JSON Drawer */}
                <div className="px-6 py-2 bg-cyan-950/10 border-l-2 border-cyan-500/30 ml-6 mb-2 text-xs text-slate-300 font-mono flex flex-col gap-2 break-all">
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-500">{'URI >>'}</span> {signal.walrusUri}
                  </div>
                  <div className="bg-black/60 border border-white/10 rounded p-3 text-[11px] leading-relaxed overflow-x-auto">
                    {JSON.stringify(
                      {
                        id: signal.id,
                        walrus_uri: signal.walrusUri,
                        valid_until: signal.validUntil,
                        pass_required: !!passInfo,
                      },
                      null,
                      2,
                    )}
                  </div>
                </div>
              </div>
            ))}

            {signals.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500 font-mono">
                Aucun signal trouvé pour {traderAddress || '—'}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
