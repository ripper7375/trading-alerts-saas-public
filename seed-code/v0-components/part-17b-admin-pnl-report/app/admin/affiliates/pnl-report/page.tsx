"use client"

import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TrendingUp, Tag, DollarSign, Users, Percent, Download } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

export default function AdminProfitLossPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig()

  // Sample data - in production, this would come from your database
  const totalSales = 342
  const regularPrice = 29.0
  const paidSales = 200
  const pendingSales = 142
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = discountedPrice * (commissionPercent / 100)

  // Dynamic calculations using SystemConfig values
  const grossRevenue = totalSales * regularPrice
  const discountPerSale = regularPrice - discountedPrice
  const totalDiscounts = totalSales * discountPerSale
  const netRevenue = grossRevenue - totalDiscounts
  const paidCommissions = paidSales * commissionAmount
  const pendingCommissions = pendingSales * commissionAmount
  const totalCommissions = paidCommissions + pendingCommissions
  const netProfit = netRevenue - totalCommissions
  const profitMargin = (netProfit / netRevenue) * 100

  // Chart data for 3-month trend
  const chartData = [
    {
      month: "Sep",
      revenue: 6420,
      costs: 1028,
      profit: 5392,
    },
    {
      month: "Oct",
      revenue: 8234,
      costs: 1317,
      profit: 6917,
    },
    {
      month: "Nov",
      revenue: netRevenue,
      costs: totalCommissions,
      profit: netProfit,
    },
  ]

  // Daily breakdown data (sample)
  const dailyBreakdown = [
    { date: "Nov 1", sales: 12, revenue: 348.0, commissions: 55.68 },
    { date: "Nov 2", sales: 15, revenue: 435.0, commissions: 69.6 },
    { date: "Nov 3", sales: 10, revenue: 290.0, commissions: 46.4 },
    { date: "Nov 4", sales: 18, revenue: 522.0, commissions: 83.52 },
    { date: "Nov 5", sales: 14, revenue: 406.0, commissions: 64.96 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Admin &gt; Affiliates &gt; P&L Report</p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Profit & Loss Report - Affiliate Program</h1>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select defaultValue="3months">
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export to PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Date Tabs */}
        <Tabs defaultValue="nov2024" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="nov2024">Nov 2024</TabsTrigger>
            <TabsTrigger value="oct2024">Oct 2024</TabsTrigger>
            <TabsTrigger value="sep2024">Sep 2024</TabsTrigger>
          </TabsList>

          <TabsContent value="nov2024" className="space-y-6 mt-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Gross Revenue */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Gross Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${grossRevenue.toLocaleString()}</div>
                  <p className="text-xs text-gray-500 mt-1">From affiliate-driven sales</p>
                </CardContent>
              </Card>

              {/* Card 2: Discounts Given */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Discounts</CardTitle>
                  <Tag className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">-${totalDiscounts.toLocaleString()}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalSales} × {discountPercent}% discount
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Net Revenue */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Net Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${netRevenue.toLocaleString()}</div>
                  <p className="text-xs text-gray-500 mt-1">After discounts</p>
                </CardContent>
              </Card>

              {/* Card 4: Total Commissions */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Commission Costs</CardTitle>
                  <Users className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">${totalCommissions.toLocaleString()}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    ${paidCommissions.toFixed(0)} paid + ${pendingCommissions.toFixed(0)} pending
                  </p>
                </CardContent>
              </Card>

              {/* Card 5: Profit Margin */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Profit Margin</CardTitle>
                  <Percent className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{profitMargin.toFixed(1)}%</div>
                  <p className="text-xs text-gray-500 mt-1">Net profit / net revenue</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown (Accounting Format)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Revenue Section */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Revenue</h3>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      <div className="text-gray-700">PRO Monthly Upgrades:</div>
                      <div className="text-right">
                        {totalSales} × ${regularPrice.toFixed(2)} = ${grossRevenue.toLocaleString()}
                      </div>
                      <div className="text-gray-700">PRO 3-Day Upgrades:</div>
                      <div className="text-right">0 × $1.99 = $0</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-bold border-t pt-2">
                      <div>Total Gross Revenue:</div>
                      <div className="text-right">${grossRevenue.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Discounts Section */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Less: Discounts</h3>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      <div className="text-gray-700">Affiliate Code Discounts:</div>
                      <div className="text-right text-red-600">
                        {discountPercent}% off applied to {totalSales} sales = -$
                        {totalDiscounts.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-bold border-t pt-2">
                      <div className="text-green-700">Net Revenue:</div>
                      <div className="text-right text-green-700">${netRevenue.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Costs Section */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg border-b pb-2">Less: Costs</h3>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      <div className="text-gray-700">Paid Commissions:</div>
                      <div className="text-right">
                        {paidSales} × ${commissionAmount.toFixed(2)} = ${paidCommissions.toLocaleString()}
                      </div>
                      <div className="text-gray-700">Pending Commissions:</div>
                      <div className="text-right">
                        {pendingSales} × ${commissionAmount.toFixed(2)} = ${pendingCommissions.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-bold border-t pt-2">
                      <div className="text-red-700">Total Commission Costs:</div>
                      <div className="text-right text-red-700">${totalCommissions.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Profit Section */}
                  <div className="space-y-2 bg-green-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 font-bold text-lg">
                      <div className="text-green-800">Net Profit:</div>
                      <div className="text-right text-green-800">${netProfit.toLocaleString()}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-bold">
                      <div className="text-green-700">Profit Margin %:</div>
                      <div className="text-right text-green-700">{profitMargin.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Dynamic Config Info */}
                  <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="font-semibold text-blue-900 mb-1">📊 Current SystemConfig:</p>
                    <p>• Affiliate Discount: {discountPercent}%</p>
                    <p>• Affiliate Commission: {commissionPercent}%</p>
                    <p>
                      • Discounted Price: ${discountedPrice.toFixed(2)} (was ${regularPrice})
                    </p>
                    <p>• Commission per Sale: ${commissionAmount.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>3-Month Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={2} name="Costs" />
                    <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detailed Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="daily-revenue">
                    <AccordionTrigger>Daily Revenue Breakdown</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {dailyBreakdown.map((day, index) => (
                          <div key={index} className="grid grid-cols-4 gap-2 py-2 border-b last:border-0">
                            <div className="font-medium">{day.date}</div>
                            <div className="text-right">{day.sales} sales</div>
                            <div className="text-right">${day.revenue.toFixed(2)}</div>
                            <div className="text-right text-gray-500">-${day.commissions.toFixed(2)} comm</div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="commission-details">
                    <AccordionTrigger>Commission Details</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Commission Rate:</div>
                          <div className="text-right font-medium">{commissionPercent}%</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Per Sale Amount:</div>
                          <div className="text-right font-medium">${commissionAmount.toFixed(2)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Paid Status:</div>
                          <div className="text-right">
                            {paidSales} sales (${paidCommissions.toFixed(2)})
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Pending Status:</div>
                          <div className="text-right">
                            {pendingSales} sales (${pendingCommissions.toFixed(2)})
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="discount-analysis">
                    <AccordionTrigger>Discount Analysis</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Discount Rate:</div>
                          <div className="text-right font-medium">{discountPercent}%</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Regular Price:</div>
                          <div className="text-right">${regularPrice.toFixed(2)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Discounted Price:</div>
                          <div className="text-right text-green-600">${discountedPrice.toFixed(2)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Discount per Sale:</div>
                          <div className="text-right text-red-600">-${discountPerSale.toFixed(2)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-gray-700">Total Discount Given:</div>
                          <div className="text-right text-red-600 font-bold">-${totalDiscounts.toLocaleString()}</div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oct2024" className="space-y-6 mt-6">
            <div className="text-center py-12 text-gray-500">
              <p>October 2024 data would be displayed here</p>
            </div>
          </TabsContent>

          <TabsContent value="sep2024" className="space-y-6 mt-6">
            <div className="text-center py-12 text-gray-500">
              <p>September 2024 data would be displayed here</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
