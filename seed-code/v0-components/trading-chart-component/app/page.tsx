import TradingChart from '@/components/trading-chart';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Trading Chart Dashboard
          </h1>
          <p className="text-gray-600">
            Professional trading analysis with TradingView Lightweight Charts
          </p>
        </div>

        {/* Free Tier Example */}
        <TradingChart
          tier="FREE"
          initialSymbol="XAUUSD"
          initialTimeframe="H1"
        />

        {/* Uncomment below to test PRO tier */}
        {/* <div className="mt-12">
          <TradingChart tier="PRO" initialSymbol="BTCUSD" initialTimeframe="M15" />
        </div> */}
      </div>
    </main>
  );
}
