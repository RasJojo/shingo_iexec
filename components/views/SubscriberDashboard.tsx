
import React from 'react';
import { Views } from '@/types';
import { Button, Card, SectionHeader } from '@/components/ui';
import { Terminal, Settings, AlertCircle } from 'lucide-react';

export const SubscriberDashboard: React.FC<{ onNavigate: (view: Views) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SectionHeader title="Command Center" subtitle="Active subscriptions and real-time performance." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Subs */}
        <div className="lg:col-span-2 space-y-4">
           {/* Sub 1 */}
           <div className="relative group bg-white/5 border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all">
              <div className="flex flex-col sm:flex-row">
                <div className="p-6 border-b sm:border-b-0 sm:border-r border-white/5 flex items-center gap-4 min-w-[250px] bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://picsum.photos/seed/1/100" className="w-12 h-12 rounded border border-white/10" alt="Avatar"/>
                    <div>
                        <h3 className="font-bold text-white font-display tracking-wide">Sui_Whale_V2</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] text-emerald-400 font-mono uppercase">Connected</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="grid grid-cols-2 gap-8 w-full sm:w-auto font-mono">
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Renewal</div>
                            <div className="text-white text-sm">12 Days</div>
                        </div>
                        <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">ROI</div>
                            <div className="text-emerald-400 text-sm">+8.4%</div>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="ghost" size="sm" icon={<Settings className="w-3 h-3"/>} />
                        <Button variant="primary" size="sm" onClick={() => onNavigate(Views.SIGNALS)} icon={<Terminal className="w-3 h-3"/>}>OPEN TERMINAL</Button>
                    </div>
                </div>
              </div>
           </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-6">
           <Card className="p-8 border-emerald-500/20 bg-emerald-900/5">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Total PnL</h3>
              <div className="text-5xl font-mono font-bold text-white text-glow-cyan mb-2">+6.3%</div>
              <p className="text-xs text-slate-500 font-mono">Aggregated across all active feeds.</p>
           </Card>
        </div>
      </div>
    </div>
  );
};
