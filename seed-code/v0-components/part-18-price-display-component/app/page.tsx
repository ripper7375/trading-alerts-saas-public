import PriceDisplay from "@/components/price-display"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Multi-Currency Price Display</h1>
          <p className="text-muted-foreground text-lg">
            Production-ready price component with dynamic discounts and real-time currency conversion
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Monthly Plan with Discount */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-center">Monthly Plan (With Discount)</h2>
            <PriceDisplay planType="monthly" hasDiscount={true} discountCode="AFFILIATE10" />
          </div>

          {/* 3-Day Plan without Discount */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-center">3-Day Trial (Regular Price)</h2>
            <PriceDisplay planType="3day" hasDiscount={false} />
          </div>
        </div>

        {/* Usage Examples */}
        <div className="mt-12 p-6 bg-muted/50 rounded-lg space-y-4">
          <h3 className="text-lg font-semibold">Features Included:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✅ Dynamic discount percentages using useAffiliateConfig hook</li>
            <li>✅ Multi-currency support (9 currencies)</li>
            <li>✅ Real-time exchange rate display with refresh</li>
            <li>✅ Automatic price breakdown calculations</li>
            <li>✅ Discount badge with savings percentage</li>
            <li>✅ Plan comparison toggle</li>
            <li>✅ Loading and error states</li>
            <li>✅ Fully responsive design</li>
            <li>✅ TypeScript with proper types</li>
            <li>✅ shadcn/ui components</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
