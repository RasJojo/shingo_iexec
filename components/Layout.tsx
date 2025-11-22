import React, { ReactNode, useState } from 'react';
import { Views } from '@/types';
import { Menu, X, Hexagon, Twitter, Github, Terminal } from 'lucide-react';
import { Button } from './ui';
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';

interface LayoutProps {
  children: ReactNode;
  currentView: Views;
  onNavigate: (view: Views) => void;
  isConnected: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, isConnected }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const account = useCurrentAccount();
  const connected = isConnected || Boolean(account?.address);
  const { mutate: disconnect } = useDisconnectWallet();

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-200 selection:bg-cyan-500/30">
      {/* Background FX */}
      <div className="aurora-bg">
        <div className="aurora-blob blob-1"></div>
        <div className="aurora-blob blob-2"></div>
        <div className="aurora-blob blob-3"></div>
      </div>
      <div className="bg-grid-fixed"></div>

      {/* Floating Navbar */}
      <nav className="fixed top-6 left-0 right-0 z-[100] px-4 md:px-6">
        <div className="max-w-6xl mx-auto bg-ash/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between h-16 px-6">
            
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer group" 
              onClick={() => onNavigate(Views.LANDING)}
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                <Hexagon className="w-8 h-8 text-white fill-white/5 stroke-1" />
                <div className="absolute inset-0 bg-cyan-500/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <span className="text-lg font-display font-bold tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                NOTASCAM
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
              {[
                { label: 'Marketplace', view: Views.MARKETPLACE },
                { label: 'Terminal', view: Views.SIGNALS },
                { label: 'Creators', view: Views.DASHBOARD_TRADER }
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => onNavigate(item.view)}
                  className={`
                    px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                    ${currentView === item.view 
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-4">
              {!connected ? (
                <ConnectButton />
              ) : (
                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                  <div className="text-right hidden lg:block">
                    <div className="text-[10px] text-slate-500 font-mono">WALLET</div>
                    <div className="text-xs font-bold text-white font-mono">
                      {account?.address ? `${account.address.slice(0, 6)}…${account.address.slice(-4)}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      disconnect();
                      localStorage.removeItem('authToken');
                    }}
                    className="text-[10px] font-mono text-slate-400 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-2">
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[90] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center space-y-8 md:hidden">
             {[
                { label: 'Marketplace', view: Views.MARKETPLACE },
                { label: 'Terminal', view: Views.SIGNALS },
                { label: 'Creators', view: Views.DASHBOARD_TRADER }
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    onNavigate(item.view);
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-2xl font-display font-bold text-white hover:text-cyan-400"
                >
                  {item.label}
                </button>
              ))}
              <ConnectButton />
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col pt-28 md:pt-36">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-black pt-20 pb-10 mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-10 mb-16">
            <div>
               <h1 className="text-[100px] leading-[0.8] font-display font-bold text-white/5 select-none tracking-tighter">
                 NOTASCAM
               </h1>
            </div>
            <div className="flex gap-6">
               <a href="#" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white hover:text-black hover:border-white transition-all"><Twitter className="w-5 h-5" /></a>
               <a href="#" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white hover:text-black hover:border-white transition-all"><Github className="w-5 h-5" /></a>
               <a href="#" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white hover:text-black hover:border-white transition-all"><Terminal className="w-5 h-5" /></a>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 text-xs font-mono text-slate-600 uppercase tracking-wider">
            <div className="flex gap-6">
               <a href="#" className="hover:text-white transition-colors">Privacy</a>
               <a href="#" className="hover:text-white transition-colors">Terms</a>
               <a href="#" className="hover:text-white transition-colors">Docs</a>
            </div>
            <div>
              © 2024 Protocol Labs. Non-custodial.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
