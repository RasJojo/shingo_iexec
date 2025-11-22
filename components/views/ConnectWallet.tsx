import React from 'react';
import { Views } from '@/types';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const ConnectWallet: React.FC<{ onNavigate: (view: Views) => void; onConnect: () => void }> = ({ onNavigate, onConnect }) => {
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
             {[
                { name: 'Sui Wallet', icon: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg' },
                { name: 'ZK Login (Google)', icon: null },
             ].map((wallet, i) => (
                <button 
                   key={i}
                   onClick={onConnect}
                   className="group w-full flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-cyan-500/30 transition-all duration-300"
                >
                   <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center border border-white/10">
                      {wallet.icon ? <img src={wallet.icon} className="w-4 h-4 rounded-full" alt={wallet.name} /> : <div className="w-4 h-4 bg-slate-700 rounded-full"></div>}
                   </div>
                   <span className="font-bold text-sm text-white font-mono">{wallet.name}</span>
                </button>
             ))}
          </div>
          
          <p className="mt-8 text-center text-xs text-slate-600 font-mono max-w-xs mx-auto">
             By connecting, you agree to the encryption protocols and on-chain verification standards.
          </p>
       </div>
    </div>
  );
};