
import React from 'react';
import { Views } from '@/types';
import { Button, Card, Badge } from '@/components/ui';
import { ArrowRight, Zap, Shield, Activity, Globe, Lock } from 'lucide-react';

// Marquee component for the infinite scroll effect
const Marquee: React.FC<{ children: React.ReactNode; reverse?: boolean }> = ({ children, reverse = false }) => (
  <div className="relative flex overflow-hidden w-full mask-linear-fade">
    <div className={`animate-marquee flex whitespace-nowrap gap-12 py-4 ${reverse ? 'direction-reverse' : ''}`}>
      {children}
      {children}
      {children}
      {children}
    </div>
  </div>
);

export const LandingPage: React.FC<{ onNavigate: (view: Views, params?: { traderId?: string }) => void }> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col w-full">
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex flex-col justify-center px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Content */}
          <div className="lg:col-span-7 z-20">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-950/10 backdrop-blur-sm mb-8 animate-fade-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-cyan-400 text-xs font-mono font-bold tracking-wider uppercase">Protocol V1 Live on Sui</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-display font-bold text-white tracking-tighter leading-[0.95] mb-8 animate-fade-up delay-100">
              VERIFIABLE <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-400 to-slate-600">ALPHA ONLY.</span>
            </h1>

            <p className="text-xl text-slate-400 max-w-xl leading-relaxed mb-10 animate-fade-up delay-200">
              The first non-custodial signal marketplace. Encrypted on-chain, executed via smart contract. Math doesn&apos;t lie.
            </p>

            <div className="flex flex-wrap gap-4 animate-fade-up delay-300">
              <Button variant="primary" size="xl" onClick={() => onNavigate(Views.MARKETPLACE)} icon={<ArrowRight />}>
                Start Copying
              </Button>
              <Button variant="secondary" size="xl" onClick={() => onNavigate(Views.DASHBOARD_TRADER)}>
                Trader Access
              </Button>
            </div>
          </div>

          {/* Abstract Visual / Stats */}
          <div className="lg:col-span-5 relative z-10 animate-fade-up delay-300">
            <div className="relative bg-ash/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-700">
              {/* Fake Terminal */}
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                <span className="ml-auto text-[10px] font-mono text-slate-500">LIVE_EXECUTION_MODULE</span>
              </div>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between text-emerald-400">
                  <span>{'>'} DETECTED_ENTRY</span>
                  <span>1.842 USDC</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{'>'} ENCRYPTING_PAYLOAD</span>
                  <span>[##########] 100%</span>
                </div>
                <div className="flex justify-between text-cyan-400">
                  <span>{'>'} BROADCASTING_TO_SUI</span>
                  <span>TX: 0x8a...f49</span>
                </div>
                <div className="p-3 bg-white/5 rounded border border-white/10 mt-4">
                  <div className="text-slate-500 uppercase text-[10px] mb-1">Net Profit (24h)</div>
                  <div className="text-2xl font-bold text-white">+12.4%</div>
                </div>
              </div>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -top-10 -right-10 bg-black border border-white/10 p-4 rounded-xl shadow-xl animate-float">
               <Badge variant="cyan" size="sm">VERIFIED</Badge>
            </div>
            <div className="absolute -bottom-5 -left-5 bg-black border border-white/10 p-4 rounded-xl shadow-xl animate-float delay-300">
               <div className="flex items-center gap-2 text-xs font-mono text-white">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span>Zero Knowledge</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker Section */}
      <section className="w-full border-y border-white/5 bg-black/50 backdrop-blur-sm py-4 mb-20">
        <Marquee>
           {[
             { pair: "SUI/USDC", val: "1.842", change: "+4.2%" },
             { pair: "BTC/USD", val: "64,204", change: "-1.2%" },
             { pair: "CETUS/SUI", val: "0.142", change: "+12.5%" },
             { pair: "NAVX/SUI", val: "0.084", change: "+8.1%" },
             { pair: "ETH/USD", val: "3,402", change: "+0.5%" },
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-4 px-8 border-r border-white/10 text-sm font-mono">
               <span className="text-slate-400">{item.pair}</span>
               <span className="text-white font-bold">{item.val}</span>
               <span className={item.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}>{item.change}</span>
             </div>
           ))}
        </Marquee>
      </section>

      {/* Bento Grid Features */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
         <div className="text-left mb-16">
           <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-4">THE PROTOCOL</h2>
           <div className="h-1 w-20 bg-cyan-500"></div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-2 gap-6 h-auto md:h-[600px]">
            {/* Large Card */}
            <Card className="md:col-span-2 md:row-span-2 p-8 flex flex-col justify-between bg-gradient-to-br from-ash to-black" hover>
               <div>
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                     <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-3xl font-display font-bold text-white mb-4">Encryption by Default</h3>
                  <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                    Signals are encrypted client-side before they ever hit the mempool. Only verified subscribers holding the NFT key can decrypt the payload. Your alpha stays yours.
                  </p>
               </div>
               <div className="mt-8 w-full h-32 bg-white/5 rounded-lg border border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-cyan-500/30"></div>
                  <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]"></div>
                  <div className="absolute top-1/2 left-3/4 w-2 h-2 bg-violet-400 rounded-full shadow-[0_0_10px_violet]"></div>
               </div>
            </Card>

            {/* Top Right */}
            <Card className="p-8" hover>
               <Zap className="w-8 h-8 text-amber-400 mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">Instant Execution</h3>
               <p className="text-sm text-slate-400">One-click execution on Cetus & Turbos via our integrated terminal.</p>
            </Card>

            {/* Bottom Right */}
            <Card className="p-8" hover>
               <Globe className="w-8 h-8 text-emerald-400 mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">On-Chain Verification</h3>
               <p className="text-sm text-slate-400">History is pulled directly from the chain. No edited screenshots allowed.</p>
            </Card>
         </div>
      </section>

      {/* CTA */}
      <section className="w-full py-32 px-6 text-center bg-gradient-to-b from-transparent to-cyan-900/10 border-t border-white/5">
         <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 tracking-tighter">
              READY TO <br/> <span className="text-cyan-400 text-glow-cyan">ASCEND?</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10">Join 12,000+ traders and subscribers on the fastest growing signal network.</p>
            <Button variant="primary" size="xl" onClick={() => onNavigate(Views.MARKETPLACE)}>
               Launch Terminal
            </Button>
         </div>
      </section>

    </div>
  );
};
