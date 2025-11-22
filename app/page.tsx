'use client';

import React, { useEffect, useState } from 'react';
import { Views } from '@/types';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/views/LandingPage';
import { Marketplace } from '@/components/views/Marketplace';
import { TraderProfile } from '@/components/views/TraderProfile';
import { SubscriberDashboard } from '@/components/views/SubscriberDashboard';
import { SignalsView } from '@/components/views/SignalsView';
import { TraderDashboard } from '@/components/views/TraderDashboard';
import { ConnectWallet } from '@/components/views/ConnectWallet';
import { useCurrentAccount } from '@mysten/dapp-kit';

export default function Home() {
  const [currentView, setCurrentView] = useState<Views>(Views.LANDING);
  const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);
  const [selectedTraderAddr, setSelectedTraderAddr] = useState<string | null>(null);
  const account = useCurrentAccount();
  const isConnected = Boolean(account?.address);

  const navigate = (view: Views, params?: { traderId?: string; traderAddr?: string }) => {
    if (params?.traderId) {
      setSelectedTraderId(params.traderId);
    }
    if (params?.traderAddr) {
      setSelectedTraderAddr(params.traderAddr);
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleConnect = () => {
    navigate(Views.MARKETPLACE);
  };

  useEffect(() => {
    if (account?.address) {
      navigate(Views.MARKETPLACE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  const renderView = () => {
    switch (currentView) {
      case Views.LANDING:
        return <LandingPage onNavigate={navigate} />;
      case Views.MARKETPLACE:
        return <Marketplace onNavigate={navigate} />;
      case Views.PROFILE:
        return <TraderProfile onNavigate={navigate} traderId={selectedTraderId} traderAddr={selectedTraderAddr} />;
      case Views.DASHBOARD_SUBSCRIBER:
        return <SubscriberDashboard onNavigate={navigate} />;
      case Views.SIGNALS:
        return <SignalsView onNavigate={navigate} isConnected={isConnected} />;
      case Views.DASHBOARD_TRADER:
        return <TraderDashboard onNavigate={navigate} />;
      case Views.CONNECT_WALLET:
        return <ConnectWallet onNavigate={navigate} onConnect={handleConnect} />;
      default:
        return <LandingPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={navigate} isConnected={isConnected}>
      {renderView()}
    </Layout>
  );
}
