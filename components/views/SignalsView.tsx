import React, { useState } from 'react';
import { Views, Signal } from '@/types';
import { Button } from '@/components/ui';
import { ArrowLeft, Lock, Copy, Zap, X, Terminal as TerminalIcon, ShieldAlert } from 'lucide-react';

const MOCK_SIGNALS: Signal[] = [
  { id: '1', market: 'SUI/USDC', side: 'BUY', position_type: 'LONG', entry_type: 'MARKET', entry_price: 1.8240, stop_loss: 1.75, take_profit: 2.1, leverage: 5, size_type: 'PERCENT', size_value: 2, slippage_bps: 50, valid_until: '2025-11-22T18:00:00Z', note: 'Breakout confirmation on 4H.' },
  { id: '2', market: 'CETUS/SUI', side: 'SELL', position_type: 'SHORT', entry_type: 'LIMIT', entry_price: 0.185, stop_loss: 0.192, take_profit: 0.16, leverage: 1, size_type: 'ABSOLUTE', size_value: 2500, slippage_bps: 30, valid_until: '2025-11-22T18:00:00Z', note: 'Range high resistance retest.' },
  { id: '3', market: 'NAVX/SUI', side: 'BUY', position_type: 'LONG', entry_type: 'MARKET', entry_price: 0.082, stop_loss: 0.075, take_profit: 0.12, leverage: 3, size_type: 'PERCENT', size_value: 1, slippage_bps: 40, valid_until: '2025-11-22T18:00:00Z', note: 'Momentum play.' },
];

export const SignalsView: React.FC<{ onNavigate: (view: Views) => void; isConnected: boolean }> = ({ onNavigate, isConnected }) => {
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

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
                Signal payload is encrypted on-chain. Connect wallet and verify subscription NFT to decrypt.
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
              <button onClick={() => onNavigate(Views.DASHBOARD_SUBSCRIBER)} className="text-slate-500 hover:text-white"><ArrowLeft className="w-5 h-5"/></button>
              <div>
                <h1 className="text-lg font-mono font-bold text-white flex items-center gap-3 uppercase tracking-wider">
                  <TerminalIcon className="w-5 h-5 text-cyan-400" />
                  Terminal <span className="text-slate-600">/</span> Sui_Whale_V2
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

        {/* Signals Stream Table - Scrollable Container */}
        <div className="w-full overflow-x-auto border border-white/5 rounded-lg bg-black/20">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-white/5">
                <div className="col-span-2">Market</div>
                <div className="col-span-1">Side</div>
                <div className="col-span-1">Entry</div>
                <div className="col-span-1 text-right">Target</div>
                <div className="col-span-1 text-right">Stop</div>
                <div className="col-span-1 text-right">Lev</div>
                <div className="col-span-1 text-right">Size</div>
                <div className="col-span-1 text-center">Slippage</div>
                <div className="col-span-2 text-center">Valid Until</div>
                <div className="col-span-2 text-right">Action</div>
            </div>

            {MOCK_SIGNALS.map((signal) => (
              <div key={signal.id} className="group relative bg-transparent border-b border-white/5 hover:bg-white/5 transition-all">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                  
                  <div className="col-span-2 font-display font-bold text-white tracking-wide">{signal.market}</div>
                  
                  <div className="col-span-1">
                      <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${signal.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {signal.side}/{signal.position_type}
                      </span>
                  </div>

                  <div className="col-span-1 text-xs font-mono text-slate-400">{signal.entry_type}</div>

                  <div className="col-span-1 text-right font-mono text-white">{signal.entry_price}</div>
                  <div className="col-span-1 text-right font-mono text-cyan-400">{signal.take_profit}</div>
                  <div className="col-span-1 text-right font-mono text-slate-500">{signal.stop_loss}</div>
                  <div className="col-span-1 text-right font-mono text-slate-300">{signal.leverage ?? 1}x</div>
                  <div className="col-span-1 text-right font-mono text-slate-300">
                    {signal.size_value}{signal.size_type === 'PERCENT' ? '%' : ''}
                  </div>
                  <div className="col-span-1 text-center text-xs font-mono text-slate-500">{signal.slippage_bps ?? 0} bps</div>
                  <div className="col-span-2 text-center text-[10px] font-mono text-slate-500">{signal.valid_until}</div>

                  <div className="col-span-2 flex justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                      {(
                        <Button 
                            variant="primary" 
                            size="sm" 
                            icon={<Zap className="w-3 h-3"/>}
                            onClick={() => setSelectedSignal(signal)}
                        >
                            EXECUTE
                        </Button>
                      )}
                      <button className="p-2 hover:bg-white/10 rounded border border-transparent hover:border-white/10 text-slate-400 hover:text-white"><Copy className="w-3 h-3"/></button>
                  </div>
                </div>
                
                {/* Notes Drawer */}
                {signal.note && (
                  <div className="px-6 py-2 bg-cyan-950/10 border-l-2 border-cyan-500/30 ml-6 mb-2 text-xs text-slate-300 font-mono flex items-start gap-2">
                      <span className="text-cyan-500">{'>>'}</span> {signal.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DEX Modal */}
      {selectedSignal && isConnected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-up">
           <div className="w-full max-w-lg bg-black border border-cyan-500/30 rounded-xl shadow-[0_0_100px_-20px_rgba(6,182,212,0.3)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-violet-500"></div>
              
              <div className="p-8">
                 <div className="flex justify-between items-start mb-8">
                     <div>
                        <h3 className="text-xl font-bold text-white font-display mb-1">EXECUTE TRADE</h3>
                        <p className="text-xs font-mono text-slate-500">ROUTING VIA CETUS AGGREGATOR</p>
                     </div>
                     <button onClick={() => setSelectedSignal(null)} className="text-slate-500 hover:text-white"><X className="w-6 h-6"/></button>
                 </div>

                 <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-8 font-mono">
                    <div className="flex justify-between mb-4">
                       <span className="text-slate-400">PAIR</span>
                       <span className="text-white font-bold">{selectedSignal.market}</span>
                    </div>
                    <div className="flex justify-between mb-4">
                       <span className="text-slate-400">SIDE</span>
                       <span className={selectedSignal.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                        {selectedSignal.side}/{selectedSignal.position_type}
                       </span>
                    </div>
                    <div className="h-px bg-white/10 my-4"></div>
                    <div className="flex justify-between">
                       <span className="text-slate-400">ENTRY PRICE</span>
                       <span className="text-white">{selectedSignal.entry_price}</span>
                    </div>
                 </div>

                 <div className="space-y-6 mb-8">
                    <div>
                       <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Position Size (SUI)</label>
                       <input type="text" className="w-full bg-black border border-white/20 rounded px-4 py-4 text-white font-mono text-xl focus:border-cyan-500 outline-none text-right" defaultValue="100.00" />
                    </div>
                 </div>

                 <Button fullWidth variant="primary" size="lg">
                    SIGN & EXECUTE
                 </Button>
                 
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
