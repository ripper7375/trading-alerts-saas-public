import DashboardHome from '@/components/dashboard-home';

// Sample data for demonstration
const sampleData = {
  userName: 'John Trader',
  userTier: 'FREE' as const,
  stats: {
    watchlist: {
      current: 3,
      max: 5,
    },
    alerts: {
      current: 2,
      max: 5,
    },
    apiUsage: {
      current: 45,
      max: 60,
    },
    chartViews: {
      current: 24,
      trend: '+12% from last week',
    },
  },
  watchlistItems: [
    {
      symbol: 'XAUUSD',
      timeframe: 'H1',
      currentPrice: 2650.5,
      change: 12.5,
      changePercent: 0.47,
      status: 'Near B-B1 Support',
      statusDistance: 0.21,
      lastUpdated: '3s ago',
    },
    {
      symbol: 'EURUSD',
      timeframe: 'H4',
      currentPrice: 1.0845,
      change: -0.0023,
      changePercent: -0.21,
      status: 'Below A-A1 Resistance',
      statusDistance: -0.15,
      lastUpdated: '12s ago',
    },
    {
      symbol: 'BTCUSD',
      timeframe: 'D1',
      currentPrice: 43250.0,
      change: 850.0,
      changePercent: 2.01,
      status: 'Above C-C1 Support',
      statusDistance: 1.23,
      lastUpdated: '8s ago',
    },
  ],
  alerts: [
    {
      id: '1',
      status: 'watching' as const,
      title: 'Gold H1 Support B-B1',
      symbol: 'XAUUSD',
      timeframe: 'H1',
      targetPrice: 2645.0,
      currentPrice: 2650.5,
      distance: -5.5,
      distancePercent: -0.21,
      createdAt: '2 hours ago',
    },
    {
      id: '2',
      status: 'triggered' as const,
      title: 'EUR Resistance Break',
      symbol: 'EURUSD',
      timeframe: 'H4',
      targetPrice: 1.085,
      currentPrice: 1.0845,
      distance: -0.0005,
      distancePercent: -0.05,
      createdAt: '1 day ago',
    },
  ],
};

export default function Page() {
  return <DashboardHome {...sampleData} />;
}
