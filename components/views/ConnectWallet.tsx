import React, { useEffect, useState } from 'react';
import { Views } from '@/types';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ConnectButton, useCurrentAccount, useSignPersonalMessage, useDisconnectWallet } from '@mysten/dapp-kit';

export const ConnectWallet: React.FC<{ onNavigate: (view: Views) => void; onConnect: () => void }> = ({ onNavigate, onConnect }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const { mutate: disconnect } = useDisconnectWallet();
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3333';

  useEffect(() => {
    if (account?.address && signed) {
      onConnect();
    }
    if (!account?.address) {
      setSigned(false);
      localStorage.removeItem('authToken');
    }
  }, [account, signed, onConnect]);

  const handleSign = async () => {
    if (!account?.address) return;
    try {
      setLoading(true);
      const res = await signMessage({
        message: new TextEncoder().encode('Login to Notascam'),
      });
      const messageBytes = res.bytes ?? new TextEncoder().encode('Login to Notascam');
      const messageB64 = btoa(String.fromCharCode(...messageBytes));
      const body = {
        wallet_address: account.address,
        signature: res.signature,
        message: messageB64,
      };
      const resp = await fetch(`${backendUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        } else {
          console.error('Auth backend: token manquant', data);
        }
      } else {
        const text = await resp.text();
        console.error('Auth backend error', resp.status, text);
      }
      setSigned(true);
    } catch (e) {
      console.error('Signature rejetée', e);
    }
    setLoading(false);
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-center px-4 relative min-h-[60vh]">
       <button 
          className="absolute top-0 left-4 flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-mono uppercase tracking-widest"
          onClick={() => onNavigate(Views.LANDING)}
       >
          <ArrowLeft className="w-4 h-4"/> Cancel
       </button>

       <div className="w-full max-w-sm animate-fade-up">
          <div className="text-center mb-12">
             <div className="w-20 h-20 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                <ShieldCheck className="w-10 h-10 text-white" />
             </div>
             <h1 className="text-2xl font-bold text-white font-display tracking-tight mb-2">AUTHENTICATE</h1>
             <p className="text-slate-500 text-sm">Secure non-custodial login.</p>
          </div>

          <div className="space-y-3">
             {!account?.address ? (
               <div className="flex justify-center">
                 <ConnectButton />
               </div>
             ) : (
                <div className="space-y-4">
                  <div className="text-center text-xs text-slate-400 font-mono">
                    Connecté : <span className="text-white">{account.address}</span>
                  </div>
                  {!signed ? (
                   <button 
                      onClick={handleSign}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300 text-sm font-mono disabled:opacity-50"
                   >
                      {loading ? 'Signature...' : "Signer pour s'authentifier"}
                   </button>
                 ) : (
                   <div className="space-y-3">
                     <div className="text-center text-emerald-400 text-sm font-mono">Signature validée</div>
                     <button
                        onClick={() => {
                          disconnect();
                          setSigned(false);
                          localStorage.removeItem('authToken');
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-sm font-mono"
                     >
                        Se déconnecter
                     </button>
                   </div>
                 )}
               </div>
             )}
          </div>
          
          <p className="mt-8 text-center text-xs text-slate-600 font-mono max-w-xs mx-auto">
             By connecting, you agree to the encryption protocols and on-chain verification standards.
          </p>
       </div>
    </div>
  );
};
