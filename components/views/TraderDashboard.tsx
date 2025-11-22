import React from 'react';
import { Views } from '@/types';
import { Button, Card } from '@/components/ui';
import { ExternalLink, Lock, UploadCloud } from 'lucide-react';

export const TraderDashboard: React.FC<{ onNavigate: (view: Views) => void }> = ({ onNavigate }) => {
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

                 <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pair</label>
                          <select className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white text-sm focus:border-violet-500 outline-none appearance-none font-mono">
                             <option>SUI / USDC</option>
                             <option>CETUS / SUI</option>
                             <option>NAVX / SUI</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Side</label>
                          <div className="flex gap-2">
                             <button className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider rounded hover:bg-emerald-500/20 transition-colors">LONG</button>
                             <button className="flex-1 py-3 bg-transparent border border-white/10 text-slate-500 text-xs font-bold tracking-wider rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors">SHORT</button>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Entry</label>
                          <input type="text" placeholder="e.g. SUI/USDC" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Stop</label>
                          <input type="text" placeholder="0.00" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Target</label>
                          <input type="text" placeholder="0.00" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Leverage</label>
                          <input type="number" placeholder="5" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Size Type</label>
                          <select className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white text-sm focus:border-violet-500 outline-none appearance-none font-mono">
                             <option value="PERCENT">PERCENT</option>
                             <option value="ABSOLUTE">ABSOLUTE</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Size Value</label>
                          <input type="number" placeholder="2" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Slippage (bps)</label>
                          <input type="number" placeholder="50" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Valid Until (ISO)</label>
                          <input type="text" placeholder="2025-11-22T18:00:00Z" className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none" />
                       </div>
                    </div>

                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Thesis (Encrypted)</label>
                       <textarea 
                          className="w-full bg-black border border-white/10 rounded px-4 py-3 text-white font-mono text-sm focus:border-violet-500 outline-none min-h-[100px]"
                          placeholder="// Explain your thesis here..."
                       ></textarea>
                    </div>

                    <div className="pt-4">
                       <Button variant="primary" size="lg" fullWidth>ENCRYPT & PUBLISH</Button>
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
