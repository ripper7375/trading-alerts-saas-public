"use client"

import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Handshake, Gift, DollarSign, LineChart, FileText, Zap, ArrowDown } from "lucide-react"
import { useState } from "react"

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  country: z.string().min(1, "Please select a country"),
  paymentMethod: z.enum(["bank", "crypto", "paypal", "payoneer"], {
    required_error: "Please select a payment method",
  }),
  paymentDetails: z.string().min(10, "Please provide payment details"),
  termsAccepted: z.boolean().refine((val) => val === true, "You must accept the terms"),
})

type FormValues = z.infer<typeof formSchema>

export default function AffiliateRegistrationPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic commission
  const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig()

  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate commission amount dynamically
  const regularPrice = 29.0
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = (discountedPrice * (commissionPercent / 100)).toFixed(2)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "user@example.com", // Pre-filled from session
      country: "",
      paymentMethod: "bank",
      paymentDetails: "",
      termsAccepted: false,
    },
  })

  const paymentMethod = form.watch("paymentMethod")

  const getPaymentPlaceholder = (method: string) => {
    switch (method) {
      case "bank":
        return "Bank name, Account number, SWIFT/IFSC code"
      case "crypto":
        return "Wallet address (BTC or USDT)"
      case "paypal":
        return "PayPal email address"
      case "payoneer":
        return "Payoneer email address"
      default:
        return "Enter your payment details"
    }
  }

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("Form submitted:", data)

    toast({
      title: "Registration Successful! 🎉",
      description: "Welcome to the affiliate program! You will receive 15 discount codes on the 1st of next month.",
    })

    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* LEFT COLUMN - REGISTRATION FORM */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <Handshake className="w-16 h-16 text-purple-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Become an Affiliate Partner</h1>
              <p className="text-lg text-gray-600">Earn ${commissionAmount} for every PRO upgrade using your codes</p>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Full Name</FormLabel>
                      <Input placeholder="John Doe" {...field} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Email Address</FormLabel>
                      <Input {...field} type="email" placeholder="you@example.com" disabled />
                      <FormDescription className="text-xs text-gray-500">This is your account email</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country */}
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="india">🇮🇳 India</SelectItem>
                          <SelectItem value="nigeria">🇳🇬 Nigeria</SelectItem>
                          <SelectItem value="pakistan">🇵🇰 Pakistan</SelectItem>
                          <SelectItem value="vietnam">🇻🇳 Vietnam</SelectItem>
                          <SelectItem value="indonesia">🇮🇩 Indonesia</SelectItem>
                          <SelectItem value="thailand">🇹🇭 Thailand</SelectItem>
                          <SelectItem value="south-africa">🇿🇦 South Africa</SelectItem>
                          <SelectItem value="turkey">🇹🇷 Turkey</SelectItem>
                          <SelectItem value="other">🌍 Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-medium text-gray-700">Preferred Payment Method</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="bank" id="bank" />
                            <label htmlFor="bank" className="text-sm cursor-pointer">
                              🏦 Bank Transfer
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="crypto" id="crypto" />
                            <label htmlFor="crypto" className="text-sm cursor-pointer">
                              ₿ Crypto Wallet (BTC/USDT)
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="paypal" id="paypal" />
                            <label htmlFor="paypal" className="text-sm cursor-pointer">
                              💳 PayPal
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="payoneer" id="payoneer" />
                            <label htmlFor="payoneer" className="text-sm cursor-pointer">
                              💰 Payoneer
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Payment Details */}
                <FormField
                  control={form.control}
                  name="paymentDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Payment Details</FormLabel>
                      <FormControl>
                        <Textarea placeholder={getPaymentPlaceholder(paymentMethod)} rows={4} {...field} />
                      </FormControl>
                      <FormDescription className="text-xs text-gray-500">
                        This information will be used to send your commissions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Terms & Conditions */}
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm text-gray-700">
                          I agree to the{" "}
                          <a href="#" className="text-blue-600 underline">
                            Affiliate Terms & Conditions
                          </a>{" "}
                          and{" "}
                          <a href="#" className="text-blue-600 underline">
                            Privacy Policy
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Registering...
                    </>
                  ) : (
                    "Register as Affiliate"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* RIGHT COLUMN - BENEFITS SECTION */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">What You&apos;ll Get</h2>

              {/* Benefits List */}
              <div className="space-y-6">
                {/* Benefit 1: 15 Codes */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Gift className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">15 Discount Codes Monthly</h3>
                    <p className="text-sm text-gray-600">
                      Automatically distributed on the 1st of each month. No manual work required!
                    </p>
                  </div>
                </div>

                {/* Benefit 2: Commission */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      ${commissionAmount} Commission per PRO Upgrade
                    </h3>
                    <p className="text-sm text-gray-600">
                      Earn {commissionPercent}% of each discounted PRO subscription ({discountPercent}% off applies to
                      customers)
                    </p>
                  </div>
                </div>

                {/* Benefit 3: Real-time Tracking */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <LineChart className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Real-time Commission Tracking</h3>
                    <p className="text-sm text-gray-600">
                      View your earnings dashboard 24/7. Track active codes, used codes, and pending commissions.
                    </p>
                  </div>
                </div>

                {/* Benefit 4: Reports */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Monthly Performance Reports</h3>
                    <p className="text-sm text-gray-600">
                      Accounting-style reports emailed automatically. Track opening/closing balances like a pro.
                    </p>
                  </div>
                </div>

                {/* Benefit 5: No Minimum */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <Zap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No Minimum Payout Threshold</h3>
                    <p className="text-sm text-gray-600">
                      Get paid whenever you request. No waiting until you reach $100 or $500.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Commission Flow Illustration */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">How It Works</h3>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-gray-900">Customer uses your discount code</p>
                </div>

                <div className="flex justify-center">
                  <ArrowDown className="w-6 h-6 text-purple-600" />
                </div>

                {/* Step 2 */}
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-gray-900">They get {discountPercent}% off</p>
                  <p className="text-xs text-gray-600 mt-1">($29.00 → ${discountedPrice.toFixed(2)}/month)</p>
                </div>

                <div className="flex justify-center">
                  <ArrowDown className="w-6 h-6 text-purple-600" />
                </div>

                {/* Step 3 */}
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-gray-900">You earn ${commissionAmount} commission</p>
                  <p className="text-xs text-gray-600 mt-1">({commissionPercent}% of discounted price)</p>
                </div>

                <div className="flex justify-center">
                  <ArrowDown className="w-6 h-6 text-purple-600" />
                </div>

                {/* Step 4 */}
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-gray-900">Payment sent to your account</p>
                  <p className="text-xs text-gray-600 mt-1">Via your chosen payment method</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
