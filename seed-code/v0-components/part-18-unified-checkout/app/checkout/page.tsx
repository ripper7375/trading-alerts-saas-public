"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check, Lock, CreditCard, Smartphone, Building, CheckCircle } from "lucide-react"

type Country = "IN" | "NG" | "PK" | "VN" | "ID" | "TH" | "ZA" | "TR" | "OTHER"
type Plan = "3day" | "monthly"
type PaymentMethod = "upi" | "paytm" | "phonepe" | "netbanking" | "card" | "bank" | "wallet"

interface CountryOption {
  code: Country
  name: string
  flag: string
  rate: number
  symbol: string
  methods: PaymentMethod[]
}

const countries: CountryOption[] = [
  {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    rate: 83,
    symbol: "₹",
    methods: ["upi", "paytm", "phonepe", "netbanking", "card"],
  },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", rate: 1580, symbol: "₦", methods: ["bank", "card", "wallet"] },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", rate: 278, symbol: "Rs", methods: ["bank", "card", "wallet"] },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", rate: 24500, symbol: "₫", methods: ["bank", "card", "wallet"] },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", rate: 15800, symbol: "Rp", methods: ["bank", "card", "wallet"] },
  { code: "TH", name: "Thailand", flag: "🇹🇭", rate: 36, symbol: "฿", methods: ["bank", "card", "wallet"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", rate: 18.5, symbol: "R", methods: ["bank", "card", "wallet"] },
  { code: "TR", name: "Turkey", flag: "🇹🇷", rate: 34, symbol: "₺", methods: ["bank", "card", "wallet"] },
  { code: "OTHER", name: "Other (Stripe only)", flag: "🌍", rate: 1, symbol: "$", methods: ["card"] },
]

const paymentMethodInfo: Record<PaymentMethod, { name: string; icon: any; badge: string; available: string }> = {
  upi: { name: "UPI", icon: Smartphone, badge: "Instant", available: "dLocal" },
  paytm: { name: "Paytm", icon: Smartphone, badge: "Instant", available: "dLocal" },
  phonepe: { name: "PhonePe", icon: Smartphone, badge: "Instant", available: "dLocal" },
  netbanking: { name: "Net Banking", icon: Building, badge: "1-2 hours", available: "dLocal" },
  card: { name: "Credit/Debit Card", icon: CreditCard, badge: "Instant", available: "Stripe" },
  bank: { name: "Bank Transfer", icon: Building, badge: "1-2 hours", available: "dLocal" },
  wallet: { name: "E-Wallet", icon: Smartphone, badge: "Instant", available: "dLocal" },
}

function CheckoutPageContent() {
  const searchParams = useSearchParams()
  const affiliateCode = searchParams.get("ref")

  // ✅ CRITICAL: Use SystemConfig hook
  const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig()

  const [detectedCountry] = useState<Country>("IN")
  const [country, setCountry] = useState<Country>("IN")
  const [showCountrySelector, setShowCountrySelector] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly")
  const [discountCode, setDiscountCode] = useState(affiliateCode || "")
  const [codeApplied, setCodeApplied] = useState(!!affiliateCode)
  const [codeError, setCodeError] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)

  const currentCountry = countries.find((c) => c.code === country)!

  // Prices
  const regularPrice = selectedPlan === "3day" ? 1.99 : 29.0
  const discountedPrice =
    codeApplied && selectedPlan === "monthly" ? calculateDiscountedPrice(regularPrice) : regularPrice
  const savings = regularPrice - discountedPrice

  // Currency conversion
  const localAmount = Math.round(discountedPrice * currentCountry.rate)
  const localRegularAmount = Math.round(regularPrice * currentCountry.rate)

  const handleApplyCode = () => {
    if (selectedPlan === "3day") {
      setCodeError("Discount codes not accepted for 3-day trial")
      return
    }
    if (discountCode.toLowerCase() === "affiliate10" || discountCode.toLowerCase().startsWith("aff")) {
      setCodeApplied(true)
      setCodeError("")
    } else {
      setCodeError("Invalid or expired code")
      setCodeApplied(false)
    }
  }

  const handlePlanChange = (plan: Plan) => {
    setSelectedPlan(plan)
    if (plan === "3day") {
      setCodeApplied(false)
      setDiscountCode("")
      setCodeError("")
    }
  }

  const isStripePayment = selectedPaymentMethod === "card"
  const isDLocalPayment = selectedPaymentMethod && selectedPaymentMethod !== "card"

  return (
    <div className="min-h-screen bg-blue-50 py-12 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">
          {/* LEFT COLUMN - CHECKOUT FORM */}
          <div className="space-y-8">
            {/* STEP 1: COUNTRY SELECTION */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Select Your Country</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showCountrySelector ? (
                  <div className="space-y-2">
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      🌍 Detected: {countries.find((c) => c.code === detectedCountry)?.name}{" "}
                      {countries.find((c) => c.code === detectedCountry)?.flag}
                    </Badge>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCountrySelector(true)}
                        className="text-sm"
                      >
                        Change Country
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Select value={country} onValueChange={(value) => setCountry(value as Country)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-sm text-gray-600">Supported methods:</span>
                  {currentCountry.methods.map((method) => (
                    <Badge key={method} variant="outline" className="text-xs">
                      {paymentMethodInfo[method].name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* STEP 2: PLAN SELECTION */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Choose Your Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* 3-Day Trial Plan */}
                  <Card
                    className={`cursor-pointer transition-all ${selectedPlan === "3day" ? "ring-2 ring-blue-600" : "hover:border-blue-300"}`}
                    onClick={() => handlePlanChange("3day")}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">dLocal Only</Badge>
                        {selectedPlan === "3day" && <CheckCircle className="w-5 h-5 text-blue-600" />}
                      </div>

                      <div>
                        <div className="text-2xl font-bold">${(1.99).toFixed(2)}</div>
                        <div className="text-lg text-gray-600">
                          ≈ {currentCountry.symbol}
                          {Math.round(1.99 * currentCountry.rate)}
                        </div>
                        <div className="text-sm text-gray-500">(at current exchange rate)</div>
                      </div>

                      <div className="text-sm text-gray-600">3 days</div>

                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Try PRO features for 3 days</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>No auto-renewal</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>No discount codes accepted</span>
                        </li>
                      </ul>

                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 w-full justify-center">
                        NO DISCOUNT CODES
                      </Badge>

                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlanChange("3day")
                        }}
                      >
                        Select
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Monthly PRO Plan */}
                  <Card
                    className={`cursor-pointer transition-all ${selectedPlan === "monthly" ? "ring-2 ring-blue-600" : "hover:border-blue-300"}`}
                    onClick={() => handlePlanChange("monthly")}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex flex-wrap gap-2 justify-between items-start">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600">Most Popular</Badge>
                          <Badge className="bg-green-500 text-white hover:bg-green-500">Stripe + dLocal</Badge>
                        </div>
                        {selectedPlan === "monthly" && <CheckCircle className="w-5 h-5 text-blue-600" />}
                      </div>

                      <div>
                        {codeApplied ? (
                          <>
                            <div className="text-sm line-through text-gray-400">${regularPrice.toFixed(2)}</div>
                            <div className="text-2xl font-bold text-green-600">${discountedPrice.toFixed(2)}</div>
                            <div className="text-lg text-gray-600">
                              ≈ {currentCountry.symbol}
                              {localAmount}
                            </div>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 mt-2">
                              Save {discountPercent}%
                            </Badge>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-bold">${regularPrice.toFixed(2)}</div>
                            <div className="text-lg text-gray-600">
                              ≈ {currentCountry.symbol}
                              {localRegularAmount}
                            </div>
                          </>
                        )}
                        <div className="text-sm text-gray-500">(at current exchange rate)</div>
                      </div>

                      <div className="text-sm text-gray-600">30 days</div>

                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Full PRO access for 30 days</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Auto-renewal (Stripe only)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Discount codes accepted</span>
                        </li>
                      </ul>

                      <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlanChange("monthly")
                        }}
                      >
                        Select
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* STEP 3: DISCOUNT CODE (only for Monthly plan) */}
            {selectedPlan === "monthly" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Have a Discount Code?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleApplyCode} variant="outline">
                      Apply
                    </Button>
                  </div>

                  {codeApplied && !codeError && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg space-y-1">
                      <div className="text-sm text-green-700 font-medium">
                        ✅ Code {discountCode.toUpperCase()} applied! Save {discountPercent}%
                      </div>
                      <div className="text-sm text-green-600">Savings: -${savings.toFixed(2)}</div>
                    </div>
                  )}

                  {codeError && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-700">❌ {codeError}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 4: PAYMENT METHOD */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Select Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedPaymentMethod || ""}
                  onValueChange={(value) => setSelectedPaymentMethod(value as PaymentMethod)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {currentCountry.methods.map((method) => {
                      const info = paymentMethodInfo[method]
                      const Icon = info.icon
                      const isSelected = selectedPaymentMethod === method

                      return (
                        <Label
                          key={method}
                          htmlFor={method}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-blue-300 ${
                            isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200"
                          }`}
                        >
                          <div className="flex flex-col items-center gap-3 text-center">
                            <RadioGroupItem value={method} id={method} className="sr-only" />
                            <Icon className={`w-8 h-8 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                            <div className="font-medium text-sm">{info.name}</div>
                            <Badge variant="secondary" className="text-xs">
                              {info.badge}
                            </Badge>
                            {method === "card" && <div className="text-xs text-gray-500">International cards</div>}
                            {isSelected && <CheckCircle className="w-5 h-5 text-blue-600 absolute top-2 right-2" />}
                          </div>
                        </Label>
                      )
                    })}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* STEP 5: PAYMENT BUTTON */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <Button
                  size="lg"
                  className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!selectedPaymentMethod}
                >
                  Pay {currentCountry.symbol}
                  {localAmount} (${discountedPrice.toFixed(2)})
                </Button>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Lock className="w-4 h-4" />
                  <span>Secured by {isStripePayment ? "Stripe" : isDLocalPayment ? "dLocal" : "Stripe/dLocal"}</span>
                </div>

                <p className="text-xs text-center text-gray-500">By clicking Pay, you agree to our Terms of Service</p>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN - ORDER SUMMARY */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Plan Details */}
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    {selectedPlan === "3day" ? "3-Day PRO Trial" : "Monthly PRO"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{selectedPlan === "3day" ? "3 days" : "30 days"}</p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>15 symbols (vs 5 FREE)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>9 timeframes (vs 3 FREE)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600" />
                      <span>20 alerts (vs 5 FREE)</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  {/* Price Breakdown */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${regularPrice.toFixed(2)}</span>
                  </div>

                  {codeApplied && selectedPlan === "monthly" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Affiliate Discount ({discountPercent}% off)</span>
                      <span className="font-medium text-green-600">-${savings.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t pt-3 flex justify-between font-bold text-lg">
                    <span>Total (USD)</span>
                    <span>${discountedPrice.toFixed(2)}</span>
                  </div>

                  <div className="text-sm text-gray-600 text-center">
                    ≈ {currentCountry.symbol}
                    {localAmount} {currentCountry.code !== "OTHER" ? currentCountry.code : "USD"}
                  </div>
                </div>

                {/* Renewal Notice */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      {selectedPaymentMethod === "card" ? (
                        <p>♻️ Auto-renews monthly (Stripe payments)</p>
                      ) : (
                        <p>⚠️ Manual renewal required (dLocal payments)</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold">Loading checkout...</div>
          </div>
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  )
}
