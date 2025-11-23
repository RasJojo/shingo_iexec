"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Views } from '@/types';
import { Button, Card } from '@/components/ui';
import { ArrowLeft, Lock, Copy, Terminal as TerminalIcon } from 'lucide-react';
import { useCurrentAccount, useCurrentWallet, useSuiClient, useSignPersonalMessage } from '@mysten/dapp-kit';
import { SUI_PACKAGE_ID } from '@/lib/sui';
import { SuiObjectResponse } from '@mysten/sui/client';
import { fetchWalrusBlob } from '@/lib/walrus';
import { sealDecrypt, buildSealApproveTx, createSealSessionKey, sealDecryptWithSession } from '@/lib/seal';

type OnchainSignal = {
  id: string;
  walrusUri: string;
  validUntil: string;
  trader: string;
  decrypted?: string | null;
  decryptedJson?: string | null;
  decryptError?: string | null;
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
  const [signals, setSignals] = useState<OnchainSignal[]>([]);
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signalType = useMemo(() => `${SUI_PACKAGE_ID}::types::SignalRef`, []);
  const passType = useMemo(() => `${SUI_PACKAGE_ID}::types::SubscriptionPass`, []);
  const signPersonalMessage = useSignPersonalMessage();
  const { currentWallet } = useCurrentWallet();
  // Wrapper standard (Wallet Standard / Slush via dapp-kit)
  const signAnyMessage = React.useCallback(
    async ({ message }: { message: Uint8Array }) => {
      if (currentWallet && account && (currentWallet as any).features?.['sui:signPersonalMessage']) {
        const feature = (currentWallet as any).features['sui:signPersonalMessage'];
        return await feature.signPersonalMessage({ account, message, chain: 'sui:testnet' });
      }
      // fallback dapp-kit hook
      return await signPersonalMessage.mutateAsync({ message, chain: 'sui:testnet' });
    },
    [currentWallet, account, signPersonalMessage],
  );

  async function fetchSignalsAndPass() {
    if (!account?.address) return;
    setLoading(true);
    setError(null);
    try {
      // Prépare session unique pour éviter de multiples signatures
      let sessionKey = await createSealSessionKey(account.address);
      let sessionSigned = false;

      const passes = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: passType },
        options: { showContent: true },
      });
      const parsedPasses = (passes.data || []).map((p) => ({
        id: p.data?.objectId ?? '',
        trader: readField<string>(p, ['trader']) ?? '',
        subscriber: readField<string>(p, ['subscriber']) ?? '',
        expiresAt: readField<string>(p, ['expires_at']) ?? '',
      }));
      const firstPass = parsedPasses[0] ?? null;
      setPassInfo(firstPass);

      const signalsAll: OnchainSignal[] = [];
      // Récupère les events SignalPublished (shared objects) puis filtre par trader/pass + valid_until
      const events = await client.queryEvents({
        query: { MoveEventType: `${SUI_PACKAGE_ID}::types::SignalPublished` },
        limit: 50,
      });
      for (const ev of events.data || []) {
        const fields = (ev as any).parsedJson || {};
        const trader = fields.trader as string;
        const validUntil = Number(fields.valid_until ?? 0);
        const id = fields.signal_id as string;
        if (!trader || !id) continue;
        // Pass détenu pour ce trader ?
        const hasPass = parsedPasses.some((p) => p.trader === trader);
        if (!hasPass) continue;
        // Affiche uniquement les actifs dans le terminal
        if (validUntil <= Date.now()) continue;
        // Récupère l'objet signal pour extraire l'URI Walrus
        const obj = await client.getObject({
          id,
          options: { showContent: true },
        });
        const walrus = readField<number[]>(obj, ['walrus_uri']) ?? [];
        const uri = decodeWalrusUri(walrus);
        if (!uri || uri.includes('test-signal')) continue;
        const blobId = uri.startsWith('walrus://') ? uri.replace('walrus://', '') : null;
        let decrypted: string | null = null;
        let decryptedJson: string | null = null;
        let decryptError: string | null = null;
        try {
          if (!blobId) {
            decryptError = 'Signal non chiffré (URI en clair)';
          } else if (!account?.address) {
            decryptError = 'Wallet non connecté';
          } else {
            const buf = await fetchWalrusBlob(blobId);
            if (!sessionSigned) {
              const pm = sessionKey.getPersonalMessage();
              const sig = await signAnyMessage({ message: pm });
              await sessionKey.setPersonalMessageSignature((sig as any).signature);
              sessionSigned = true;
            }
            const passId = parsedPasses.find((p) => p.trader === trader)?.id || '';
            const txb = await buildSealApproveTx(id, passId, SUI_PACKAGE_ID, account.address);
            const plain = await sealDecryptWithSession(new Uint8Array(buf), sessionKey, txb);
            decrypted = new TextDecoder().decode(plain);
            try {
              const parsed = JSON.parse(decrypted);
              decryptedJson = JSON.stringify(parsed, null, 2);
            } catch {
              decryptedJson = decrypted;
            }
          }
        } catch (e) {
          decryptError = (e as any)?.message ?? 'Déchiffrement impossible';
        }
        signalsAll.push({
          id,
          walrusUri: uri,
          validUntil: validUntil.toString(),
          trader,
          decrypted,
          decryptedJson,
          decryptError,
        } as any);
      }
      setSignals(signalsAll);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue lors du chargement on-chain');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConnected) fetchSignalsAndPass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, account?.address]);

  return (
    <div className="relative max-w-[1600px] mx-auto px-4 py-6 w-full min-h-[60vh]">
      {!isConnected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-black border border-red-500/30 p-8 rounded-2xl text-center max-w-md shadow-[0_0_50px_-10px_rgba(220,38,38,0.3)]">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 animate-pulse">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white font-display mb-2">ENCRYPTED CHANNEL</h2>
            <p className="text-slate-400 text-sm font-mono mb-8">Connecte ton wallet et présente ton SubscriptionPass pour déchiffrer.</p>
            <Button variant="primary" fullWidth onClick={() => onNavigate(Views.CONNECT_WALLET)}>
              AUTHENTICATE KEY
            </Button>
          </div>
        </div>
      )}

      <div className={`transition-all duration-500 ${!isConnected ? 'blur-md pointer-events-none opacity-50 select-none' : ''}`}>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="text-sm font-mono text-slate-400">
            Pass détenu : {passInfo ? passInfo.id : 'aucun'} {passInfo?.trader ? `(trader ${passInfo.trader})` : ''}
          </div>
          <Button variant="primary" onClick={fetchSignalsAndPass} disabled={loading || !account}>
            {loading ? 'Chargement...' : 'Sync on-chain'}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-mono">
          {passInfo ? (
            <>
              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Pass OK · trader: {passInfo.trader} · expires_at: {passInfo.expiresAt}
              </span>
              <span className="text-slate-500">pass id {passInfo.id}</span>
            </>
          ) : (
            <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30">Aucun pass détecté (connecte un wallet abonné)</span>
          )}
          <span className="text-slate-500">Package {SUI_PACKAGE_ID}</span>
        </div>

        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/30 rounded px-3 py-2 font-mono">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {signals.map((signal) => (
            <Card key={signal.id} className="p-4 border border-white/10 bg-white/5 space-y-2">
              <div className="text-xs text-slate-500 font-mono">Signal {signal.id.slice(0, 10)}…</div>
              <div className="text-sm text-white font-mono">Trader: {signal.trader}</div>
              <div className="text-sm text-slate-400 font-mono">Valid Until: {signal.validUntil}</div>
              <div className="text-xs text-slate-500 font-mono break-all">URI: {signal.walrusUri}</div>
              {signal.decryptedJson ? (
                <div>
                  <div className="text-xs text-emerald-400 font-mono mb-1">Contenu déchiffré</div>
                  <pre className="text-xs bg-black/60 border border-emerald-500/30 rounded p-2 overflow-auto text-emerald-200">
                    {signal.decryptedJson}
                  </pre>
                </div>
              ) : (
                <div className="text-xs text-red-400 font-mono">
                  {signal.decryptError ? `Déchiffrement échoué: ${signal.decryptError}` : 'Déchiffrement en attente…'}
                </div>
              )}
            </Card>
          ))}
          {signals.length === 0 && !loading && <div className="p-8 text-center text-sm text-slate-500 font-mono">Aucun signal trouvé pour vos passes.</div>}
        </div>
      </div>
    </div>
  );
};
