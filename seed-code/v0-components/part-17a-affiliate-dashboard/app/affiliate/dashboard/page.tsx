"use client"

import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tag, CheckCircle, DollarSign, Wallet, Clipboard, Download, Share, TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useState } from "react"

export default function AffiliateDashboardPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const { commissionPercent, discountPercent, calculateDiscountedPrice } = useAffiliateConfig()

  // Calculate commission dynamically based on SystemConfig
  const regularPrice = 29.0
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = discountedPrice * (commissionPercent / 100)

  // Mock data
  const activeCodes = 12
  const totalCodes = 15
  const codesUsed = 8
  const totalEarnings = (codesUsed * commissionAmount).toFixed(2)
  const paidEarnings = "25.60"
  const affiliateName = "Sarah Johnson"
  const affiliateId = "AFF12345"

  // Mock transactions data
  const transactions = [
    { date: "Jan 20, 2024", code: "SAVE20JAN", email: "user1@example.com", status: "Pending" },
    { date: "Jan 19, 2024", code: "WINTER20", email: "user2@example.com", status: "Paid" },
    { date: "Jan 18, 2024", code: "SAVE20JAN", email: "user3@example.com", status: "Pending" },
    { date: "Jan 17, 2024", code: "NEWYEAR20", email: "user4@example.com", status: "Paid" },
    { date: "Jan 16, 2024", code: "SAVE20JAN", email: "user5@example.com", status: "Pending" },
    { date: "Jan 15, 2024", code: "WINTER20", email: "user6@example.com", status: "Paid" },
    { date: "Jan 14, 2024", code: "SAVE20JAN", email: "user7@example.com", status: "Paid" },
    { date: "Jan 13, 2024", code: "NEWYEAR20", email: "user8@example.com", status: "Paid" },
  ]

  // Mock chart data (last 6 months)
  const chartData = [
    { month: "Aug", earnings: 18.56 },
    { month: "Sep", earnings: 23.2 },
    { month: "Oct", earnings: 27.84 },
    { month: "Nov", earnings: 32.48 },
    { month: "Dec", earnings: 41.76 },
    { month: "Jan", earnings: Number.parseFloat(totalEarnings) },
  ]

  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopyAllCodes = () => {
    const codes = ["SAVE20JAN", "WINTER20", "NEWYEAR20", "SPRING20"]
    navigator.clipboard.writeText(codes.join(", "))
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleCopyAffiliateLink = () => {
    navigator.clipboard.writeText(`https://app.com/?ref=${affiliateId}`)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleDownloadReport = () => {
    // Mock PDF download
    alert("Monthly report download started")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back, {affiliateName}</h1>
          <p className="text-sm text-gray-600">Last login: 2 hours ago</p>
        </div>

        {/* Toast notification for copy success */}
        {copySuccess && (
          <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-top">
            ✓ Copied to clipboard!
          </div>
        )}

        {/* Stat Cards - 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Codes */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Active Codes</CardTitle>
              <Tag className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {activeCodes}/{totalCodes}
              </div>
              <Progress value={(activeCodes / totalCodes) * 100} className="h-2 mb-2" />
              <p className="text-xs text-gray-600">{totalCodes - activeCodes} available to distribute</p>
            </CardContent>
          </Card>

          {/* Card 2: Codes Used This Month */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Codes Used This Month</CardTitle>
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-2">{codesUsed}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                +3 from last month
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Total Earnings */}
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total Earnings</CardTitle>
              <DollarSign className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-2">${totalEarnings}</div>
              <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Pending</Badge>
              <p className="text-xs text-gray-600 mt-2">
                {codesUsed} sales × ${commissionAmount.toFixed(2)} ({commissionPercent}%)
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Paid Commissions */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Paid Commissions</CardTitle>
              <Wallet className="h-5 w-5 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-2">${paidEarnings}</div>
              <p className="text-xs text-gray-600">Last payment: Jan 15, 2024</p>
            </CardContent>
          </Card>
        </div>

        {/* Code Inventory Report and Commission Breakdown Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Inventory Report */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Code Inventory Report</CardTitle>
              <CardDescription>Current Month (January 2024)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Opening Balance (Jan 1)</span>
                  <span className="text-sm font-semibold">10 codes</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">+ Codes Distributed</span>
                  <span className="text-sm font-semibold text-green-600">5 codes</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">- Codes Used</span>
                  <span className="text-sm font-semibold text-red-600">8 codes</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">- Codes Expired</span>
                  <span className="text-sm font-semibold text-red-600">0 codes</span>
                </div>
                <div className="flex justify-between py-2 bg-gray-50 px-2 rounded">
                  <span className="text-sm font-bold text-gray-900">= Closing Balance (Current)</span>
                  <span className="text-sm font-bold text-gray-900">{activeCodes} codes</span>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Active vs Total</span>
                  <span className="text-sm font-semibold">{Math.round((activeCodes / totalCodes) * 100)}% active</span>
                </div>
                <Progress value={(activeCodes / totalCodes) * 100} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Commission Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 5).map((transaction, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs">{transaction.date}</TableCell>
                        <TableCell className="text-xs font-mono">{transaction.code}</TableCell>
                        <TableCell className="text-xs font-semibold">${commissionAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              transaction.status === "Paid"
                                ? "bg-green-500 text-white hover:bg-green-600"
                                : "bg-yellow-500 text-white hover:bg-yellow-600"
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" className="w-full mt-4 bg-transparent">
                View All Transactions
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Full Width Commission Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">All Recent Commissions</CardTitle>
            <CardDescription>Last 10 transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Code Used</TableHead>
                    <TableHead>User Email</TableHead>
                    <TableHead>Commission Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{transaction.date}</TableCell>
                      <TableCell className="font-mono text-sm">{transaction.code}</TableCell>
                      <TableCell className="text-sm text-gray-600">{transaction.email.split("@")[0]}@...</TableCell>
                      <TableCell className="font-semibold text-green-600">${commissionAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            transaction.status === "Paid"
                              ? "bg-green-500 text-white hover:bg-green-600"
                              : "bg-yellow-500 text-white hover:bg-yellow-600"
                          }
                        >
                          {transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" className="w-full mt-4 bg-transparent">
              View All
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions and Performance Chart Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleCopyAllCodes}>
                <Clipboard className="h-4 w-4 mr-2" />
                Copy All Active Codes
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleDownloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download Monthly Report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent"
                onClick={handleCopyAffiliateLink}
              >
                <Share className="h-4 w-4 mr-2" />
                Share Affiliate Link
              </Button>
            </CardContent>
          </Card>

          {/* Performance Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Commission Earnings Over Time</CardTitle>
              <CardDescription>Last 6 months performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "8px",
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Earnings"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Current Commission Rate: {commissionPercent}%</h3>
                <p className="text-sm text-gray-600">
                  You earn ${commissionAmount.toFixed(2)} per sale (regular price ${regularPrice.toFixed(2)} with{" "}
                  {discountPercent}% discount = ${discountedPrice.toFixed(2)}). Keep sharing your codes to maximize your
                  earnings!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
