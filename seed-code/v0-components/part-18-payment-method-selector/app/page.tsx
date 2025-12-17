"use client"

import { useState } from "react"
import PaymentMethodSelector from "@/components/payment-method-selector"

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState<"IN" | "NG" | "PK" | "VN" | "ID" | "TH" | "ZA" | "TR">("IN")
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const countries = [
    { code: "IN" as const, name: "India" },
    { code: "NG" as const, name: "Nigeria" },
    { code: "PK" as const, name: "Pakistan" },
    { code: "ID" as const, name: "Indonesia" },
    { code: "VN" as const, name: "Vietnam" },
    { code: "TH" as const, name: "Thailand" },
    { code: "ZA" as const, name: "South Africa" },
    { code: "TR" as const, name: "Turkey" },
  ]

  const handleCountryChange = (country: typeof selectedCountry) => {
    setSelectedCountry(country)
    setSelectedMethod(null) // Reset selected method when country changes
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Payment Gateway Demo</h1>
          <p className="text-lg text-gray-600">Experience local payment methods across emerging markets</p>
        </div>

        {/* Country Selector */}
        <div className="mb-8 flex flex-wrap gap-2 justify-center">
          {countries.map((country) => (
            <button
              key={country.code}
              onClick={() => handleCountryChange(country.code)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                selectedCountry === country.code
                  ? "bg-blue-600 text-white shadow-lg scale-105"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:shadow-md"
              }`}
            >
              {country.name}
            </button>
          ))}
        </div>

        {/* Payment Method Selector */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <PaymentMethodSelector
            country={selectedCountry}
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
          />
        </div>

        {/* Selected Method Display */}
        {selectedMethod && (
          <div className="mt-8 bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
            <p className="text-lg font-semibold text-green-800">
              ✓ Selected Payment Method: <span className="font-bold">{selectedMethod.toUpperCase()}</span>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
