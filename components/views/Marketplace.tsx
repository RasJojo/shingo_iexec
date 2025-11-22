import React, { useState } from 'react';
import { Views } from '@/types';
import { TRADERS } from '@/lib/data';
import { Card, Badge, SectionHeader } from '@/components/ui';
import { Search, ArrowUpRight } from 'lucide-react';

export const Marketplace: React.FC<{ onNavigate: (view: Views, params?: any) => void }> = ({ onNavigate }) => {
  const [filterRisk, setFilterRisk] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = TRADERS.filter(t => {
    if (filterRisk && t.riskLevel !== filterRisk) return false;
    if (searchTerm && !t.handle.toLowerCase().includes(searchTerm.toLowerCase()) && !t.strategyTags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      
      <SectionHeader 
        title="Alpha Marketplace" 
        subtitle="Discover and copy the most profitable verified strategies on Sui."
      />

      {/* Filters Toolbar */}
      <div className="sticky top-28 z-30 bg-black/80 backdrop-blur-xl border border-white/10 py-3 px-4 rounded-xl mb-10 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-2xl">
          
          {/* Search */}
          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input 
              type="text" 
              placeholder="SEARCH PROTOCOLS..." 
              className="w-full bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono py-3 pl-10 pr-4 focus:border-cyan-500/50 focus:bg-white/10 outline-none transition-all uppercase tracking-wider placeholder:text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Buttons - Scrollable on Mobile */}
          <div className="w-full lg:w-auto overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 min-w-max">
              {['Conservative', 'Balanced', 'Aggressive'].map(risk => (
                <button
                  key={risk}
                  onClick={() => setFilterRisk(filterRisk === risk ? null : risk)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono border transition-all whitespace-nowrap ${filterRisk === risk ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'bg-transparent border-white/10 text-slate-400 hover:border-white/30'}`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((trader) => (
          <Card key={trader.id} hover className="flex flex-col h-full group" onClick={() => onNavigate(Views.PROFILE, { traderId: trader.id })}>
            <div className="p-6 flex-1 flex flex-col relative">
              {/* Accent Line */}
              <div className={`absolute top-0 left-0 w-full h-0.5 ${trader.pnl30d > 0 ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_10px_currentColor]`}></div>

              {/* Header */}
              <div className="flex justify-between items-start mb-6 mt-2">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-md bg-slate-800 border border-white/10 overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={trader.avatar} alt={trader.handle} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <h3 className="font-bold font-display text-white text-lg tracking-tight truncate">{trader.handle}</h3>
                         {trader.isVerified && <div className="shrink-0 text-[8px] bg-cyan-500 text-black px-1 rounded font-bold">VERIFIED</div>}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {trader.strategyTags.slice(0, 2).map(tag => (
                          <Badge key={tag} size="sm" variant="neutral">{tag}</Badge>
                        ))}
                      </div>
                   </div>
                 </div>
              </div>

              {/* Bio */}
              <p className="text-xs font-mono text-slate-500 mb-8 line-clamp-2 leading-relaxed">
                {'// '}{trader.description}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4 mb-8 bg-white/5 rounded-lg p-4 border border-white/5">
                <div>
                   <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">30d PnL</div>
                   <div className={`font-mono font-bold text-sm ${trader.pnl30d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {trader.pnl30d > 0 ? '+' : ''}{trader.pnl30d}%
                   </div>
                </div>
                 <div>
                   <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Max DD</div>
                   <div className="font-mono font-bold text-sm text-slate-300">
                     -{trader.drawdown}%
                   </div>
                </div>
                 <div>
                   <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Subs</div>
                   <div className="font-mono font-bold text-sm text-white">
                     {trader.subscribers}
                   </div>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                 <div className="text-xs font-mono text-slate-400">
                    <span className="text-white font-bold text-sm">{trader.subscriptionPrice} SUI</span> / mo
                 </div>
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-black transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                 </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
