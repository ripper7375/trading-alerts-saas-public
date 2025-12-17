"use client"

import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, CreditCard, Building, Smartphone, QrCode } from "lucide-react"

interface PaymentMethod {
  id: string
  name: string
  icon: React.ReactNode
  processingTime: "Instant" | "1-2 hours"
  sublabel?: string
}

interface PaymentMethodSelectorProps {
  country: "IN" | "NG" | "PK" | "VN" | "ID" | "TH" | "ZA" | "TR"
  selectedMethod: string | null
  onSelectMethod: (method: string) => void
}

const paymentMethodsByCountry: Record<string, PaymentMethod[]> = {
  IN: [
    { id: "upi", name: "UPI", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "paytm", name: "Paytm Wallet", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "phonepe", name: "PhonePe", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "netbanking", name: "Net Banking", icon: <Building className="w-16 h-16" />, processingTime: "1-2 hours" },
    {
      id: "stripe",
      name: "Card Payment",
      icon: <CreditCard className="w-16 h-16" />,
      processingTime: "Instant",
      sublabel: "International cards",
    },
  ],
  NG: [
    {
      id: "bank-transfer",
      name: "Bank Transfer",
      icon: <Building className="w-16 h-16" />,
      processingTime: "1-2 hours",
    },
    { id: "ussd", name: "USSD", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "paystack", name: "Paystack", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
    { id: "verve", name: "Verve Card", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  PK: [
    { id: "jazzcash", name: "JazzCash", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "easypaisa", name: "Easypaisa", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  ID: [
    { id: "gopay", name: "GoPay", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "ovo", name: "OVO", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "dana", name: "Dana", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "shopeepay", name: "ShopeePay", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  VN: [
    { id: "vnpay", name: "VNPay", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
    { id: "momo", name: "MoMo", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "zalopay", name: "ZaloPay", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  TH: [
    { id: "truemoney", name: "TrueMoney", icon: <Smartphone className="w-16 h-16" />, processingTime: "Instant" },
    {
      id: "rabbit-line-pay",
      name: "Rabbit LINE Pay",
      icon: <Smartphone className="w-16 h-16" />,
      processingTime: "Instant",
    },
    { id: "thai-qr", name: "Thai QR", icon: <QrCode className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  ZA: [
    { id: "instant-eft", name: "Instant EFT", icon: <Building className="w-16 h-16" />, processingTime: "Instant" },
    { id: "eft", name: "EFT", icon: <Building className="w-16 h-16" />, processingTime: "1-2 hours" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
  TR: [
    {
      id: "bank-transfer",
      name: "Bank Transfer",
      icon: <Building className="w-16 h-16" />,
      processingTime: "1-2 hours",
    },
    { id: "local-cards", name: "Turkish Cards", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
    { id: "stripe", name: "Card Payment", icon: <CreditCard className="w-16 h-16" />, processingTime: "Instant" },
  ],
}

export default function PaymentMethodSelector({ country, selectedMethod, onSelectMethod }: PaymentMethodSelectorProps) {
  const methods = paymentMethodsByCountry[country] || []

  const handleKeyDown = (event: React.KeyboardEvent, methodId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelectMethod(methodId)
    }
  }

  return (
    <div className="w-full">
      <h3 className="text-2xl font-bold mb-2">Choose Payment Method</h3>
      <p className="text-gray-600 mb-6">Select your preferred local payment option</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map((method) => {
          const isSelected = selectedMethod === method.id

          return (
            <Card
              key={method.id}
              className={`relative cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg focus-within:outline-blue-600 focus-within:outline focus-within:outline-2 ${
                isSelected ? "border-2 border-blue-600 bg-blue-50" : "border border-gray-200 bg-white hover:shadow-md"
              }`}
              onClick={() => onSelectMethod(method.id)}
              onKeyDown={(e) => handleKeyDown(e, method.id)}
              tabIndex={0}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${method.name}, ${method.processingTime}${method.sublabel ? `, ${method.sublabel}` : ""}`}
            >
              {isSelected && (
                <CheckCircle className="absolute top-2 right-2 text-green-600" size={24} aria-hidden="true" />
              )}
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="mb-3 text-gray-700" aria-hidden="true">
                  {method.icon}
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-2">{method.name}</p>
                {method.sublabel && <p className="text-xs text-gray-500 mb-2">{method.sublabel}</p>}
                <Badge
                  variant="secondary"
                  className={`text-xs rounded-full px-3 py-1 ${
                    method.processingTime === "Instant"
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                  }`}
                >
                  {method.processingTime}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
