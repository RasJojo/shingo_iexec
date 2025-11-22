'use client';

import React, { useState } from 'react';
import { Views } from '@/types';
import { Layout } from '@/components/Layout';
import { LandingPage } from '@/components/views/LandingPage';
import { Marketplace } from '@/components/views/Marketplace';
import { TraderProfile } from '@/components/views/TraderProfile';
import { SubscriberDashboard } from '@/components/views/SubscriberDashboard';
import { SignalsView } from '@/components/views/SignalsView';
import { TraderDashboard } from '@/components/views/TraderDashboard';
import { ConnectWallet } from '@/components/views/ConnectWallet';

export default function Home() {
  const [currentView, setCurrentView] = useState<Views>(Views.LANDING);
  const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const navigate = (view: Views, params?: { traderId?: string }) => {
    if (params?.traderId) {
      setSelectedTraderId(params.traderId);
    }
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleConnect = () => {
    setIsConnected(true);
    navigate(Views.MARKETPLACE);
  };

  const renderView = () => {
    switch (currentView) {
      case Views.LANDING:
        return <LandingPage onNavigate={navigate} />;
      case Views.MARKETPLACE:
        return <Marketplace onNavigate={navigate} />;
      case Views.PROFILE:
        return <TraderProfile onNavigate={navigate} traderId={selectedTraderId} />;
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