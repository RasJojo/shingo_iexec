
import React from 'react';
import { Views } from '@/types';
import { TRADERS } from '@/lib/data';
import { Button, Card, Badge, Metric } from '@/components/ui';
import { ArrowLeft, ShieldCheck, Lock, ExternalLink, Share2, Zap, FileJson, LayoutDashboard } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const CHART_DATA = [
  { date: 'Sep', value: 1000 },
  { date: 'Oct', value: 1450 },
  { date: 'Nov', value: 1320 },
  { date: 'Dec', value: 1890 },
  { date: 'Jan', value: 2450 },
  { date: 'Feb', value: 2100 },
  { date: 'Mar', value: 2800 },
];

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

export const TraderProfile: React.FC<{ onNavigate: (view: Views) => void; traderId: string | null }> = ({ onNavigate, traderId }) => {
  
  const trader = TRADERS.find(t => t.id === traderId) || TRADERS[0];

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

                <div className="flex flex-wrap gap-2 mb-6">
                  <Badge variant={trader.riskLevel === 'Aggressive' ? 'acid' : 'neutral'} size="sm">{trader.riskLevel}</Badge>
                  {trader.strategyTags.map(tag => <Badge key={tag} variant="neutral" size="sm">{tag}</Badge>)}
                </div>

                <p className="text-slate-400 text-sm leading-relaxed mb-8 font-light">
                  {trader.description}
                </p>

                <div className="bg-white/5 rounded-xl border border-white/5 p-4 mb-6">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-bold text-white">Monthly Access</span>
                      <span className="text-lg font-mono text-cyan-400 font-bold">{trader.subscriptionPrice} SUI</span>
                   </div>
                   <Button fullWidth variant="primary" className="justify-between group mb-4" onClick={() => onNavigate(Views.SIGNALS)}>
                      <span className="font-bold">SUBSCRIBE NOW</span>
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

          {/* Advanced Stats */}
          <div className="p-6 rounded-xl border border-white/5 bg-white/5 space-y-4">
             <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Advanced Metrics</h3>
             <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm text-slate-400">Profit Factor</span>
                <span className="font-mono text-white font-bold">2.45</span>
             </div>
             <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm text-slate-400">Avg. Hold Time</span>
                <span className="font-mono text-white font-bold">4h 12m</span>
             </div>
             <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm text-slate-400">Sharpe Ratio</span>
                <span className="font-mono text-white font-bold">1.8</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Best Trade</span>
                <span className="font-mono text-emerald-400 font-bold">+420%</span>
             </div>
          </div>
        </div>

        {/* Right Col: Data & History */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Performance Chart */}
          <Card className="p-8">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-xl font-bold text-white font-display">EQUITY CURVE</h2>
                   <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Verified on-chain history</p>
                </div>
                <div className="text-right">
                   <div className={`text-3xl font-bold font-mono tracking-tight ${trader.pnl30d > 0 ? 'text-emerald-400 text-shadow-emerald' : 'text-red-400'}`}>
                     {trader.pnl30d > 0 ? '+' : ''}{trader.pnl30d}%
                   </div>
                </div>
             </div>

             <div className="h-[300px] w-full -ml-2 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trader.pnl30d > 0 ? '#10b981' : '#ef4444'} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={trader.pnl30d > 0 ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="date" stroke="#444" tick={{fontSize: 10, fontFamily: 'monospace'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#444" tick={{fontSize: 10, fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: trader.pnl30d > 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}
                  />
                  <Area type="monotone" dataKey="value" stroke={trader.pnl30d > 0 ? '#10b981' : '#ef4444'} strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-white/5">
                <Metric label="Total PnL" value={`${trader.pnlTotal > 0 ? '+' : ''}${trader.pnlTotal}%`} trend={2.1} />
                <Metric label="Winrate" value={`${trader.winRate}%`} />
                <Metric label="Drawdown" value={`-${trader.drawdown}%`} />
                <Metric label="Subscribers" value={trader.subscribers.toString()} />
             </div>
          </Card>

          {/* Monthly Returns Heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6">
                <h3 className="text-sm font-bold text-white font-display mb-4">MONTHLY RETURNS</h3>
                <div className="grid grid-cols-4 gap-2">
                   {MONTHLY_RETURNS.map((m) => (
                      <div key={m.month} className="bg-white/5 rounded p-2 text-center">
                         <div className="text-[10px] text-slate-500 uppercase mb-1">{m.month}</div>
                         <div className={`text-xs font-mono font-bold ${m.val > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {m.val > 0 ? '+' : ''}{m.val}%
                         </div>
                      </div>
                   ))}
                </div>
             </Card>

             <Card className="p-6">
                <h3 className="text-sm font-bold text-white font-display mb-4">ASSET ALLOCATION</h3>
                <div className="space-y-3">
                    {trader.assets.map((asset, i) => (
                       <div key={asset} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/10">
                             {asset}
                          </div>
                          <div className="flex-1">
                             <div className="flex justify-between text-xs mb-1">
                                <span className="text-white font-bold">{asset}</span>
                                <span className="text-slate-400">{50 - (i*10)}%</span>
                             </div>
                             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500" style={{ width: `${50 - (i*10)}%`}}></div>
                             </div>
                          </div>
                       </div>
                    ))}
                </div>
             </Card>
          </div>

          {/* Encrypted History Preview */}
          <div className="pt-4">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white font-display">RECENT SIGNALS</h3>
                <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   LIVE FEED
                </div>
             </div>

             <div className="space-y-1 font-mono text-sm">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="group flex items-center justify-between p-4 border border-white/5 rounded bg-white/5 hover:bg-white/10 transition-colors">
                     <div className="flex items-center gap-6">
                        <span className="text-slate-600 text-xs">2h ago</span>
                        <span className={`font-bold ${i%2===0 ? 'text-red-400' : 'text-emerald-400'}`}>
                           {i%2===0 ? 'SHORT' : 'LONG'}
                        </span>
                        <span className="text-white">{trader.assets[0] || 'SUI'}/USDC</span>
                     </div>
                     
                     {i < 2 ? (
                        <div className="text-emerald-400">
                           TP HIT <span className="opacity-50">(+12%)</span>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 text-slate-500 opacity-50">
                           <Lock className="w-3 h-3" /> 
                           <span>0x7a...9f2</span>
                        </div>
                     )}
                  </div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};