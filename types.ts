export interface Trader {
  id: string;
  handle: string;
  avatar: string;
  pnl30d: number;
  pnlTotal: number;
  winRate: number;
  drawdown: number;
  subscribers: number;
  riskLevel: 'Conservative' | 'Balanced' | 'Aggressive';
  strategyTags: string[];
  description: string;
  subscriptionPrice: number;
  isVerified?: boolean;
  assets: string[];
}

export interface Signal {
  id: string;
  market: string;
  side: 'BUY' | 'SELL';
  position_type: 'LONG' | 'SHORT';
  entry_type: 'MARKET' | 'LIMIT';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  leverage?: number;
  size_type: 'PERCENT' | 'ABSOLUTE';
  size_value: number;
  slippage_bps?: number;
  valid_until: string;
  note?: string;
}

export interface Subscription {
  id: string;
  traderId: string;
  traderHandle: string;
  traderAvatar: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
  monthlyCost: number;
  pnlSinceSub: number;
}

export enum Views {
  LANDING = 'LANDING',
  MARKETPLACE = 'MARKETPLACE',
  PROFILE = 'PROFILE',
  DASHBOARD_SUBSCRIBER = 'DASHBOARD_SUBSCRIBER',
  DASHBOARD_TRADER = 'DASHBOARD_TRADER',
  SIGNALS = 'SIGNALS',
  CONNECT_WALLET = 'CONNECT_WALLET'
}
