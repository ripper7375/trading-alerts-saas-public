import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Unified Checkout Demo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-gray-600">Complete checkout page with Stripe + dLocal payment support</p>
          <Link href="/checkout">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Go to Checkout</Button>
          </Link>
          <Link href="/checkout?ref=AFFILIATE10">
            <Button variant="outline" className="w-full bg-transparent">
              Checkout with Affiliate Code
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
