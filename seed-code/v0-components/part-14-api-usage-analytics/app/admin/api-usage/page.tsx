"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Activity,
  Users,
  Crown,
  Clock,
  Download,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

// Mock data for time series (last 30 days)
const timeSeriesData = [
  { date: "Jan 1", free: 12000, pro: 20000 },
  { date: "Jan 2", free: 13500, pro: 21000 },
  { date: "Jan 3", free: 14200, pro: 22500 },
  { date: "Jan 4", free: 13800, pro: 23000 },
  { date: "Jan 5", free: 15000, pro: 24000 },
  { date: "Jan 6", free: 14500, pro: 24500 },
  { date: "Jan 7", free: 15500, pro: 25000 },
  { date: "Jan 8", free: 16000, pro: 26000 },
  { date: "Jan 9", free: 15800, pro: 26500 },
  { date: "Jan 10", free: 16500, pro: 27000 },
  { date: "Jan 11", free: 17000, pro: 27500 },
  { date: "Jan 12", free: 16800, pro: 28000 },
  { date: "Jan 13", free: 17500, pro: 28500 },
  { date: "Jan 14", free: 18000, pro: 29000 },
  { date: "Jan 15", free: 17800, pro: 29500 },
  { date: "Jan 16", free: 18500, pro: 30000 },
  { date: "Jan 17", free: 19000, pro: 30500 },
  { date: "Jan 18", free: 18800, pro: 31000 },
  { date: "Jan 19", free: 19500, pro: 31500 },
  { date: "Jan 20", free: 20000, pro: 32000 },
  { date: "Jan 21", free: 19800, pro: 32500 },
  { date: "Jan 22", free: 20500, pro: 33000 },
  { date: "Jan 23", free: 21000, pro: 33500 },
  { date: "Jan 24", free: 20800, pro: 34000 },
  { date: "Jan 25", free: 21500, pro: 34500 },
  { date: "Jan 26", free: 22000, pro: 35000 },
  { date: "Jan 27", free: 21800, pro: 35500 },
  { date: "Jan 28", free: 22500, pro: 36000 },
  { date: "Jan 29", free: 23000, pro: 36500 },
  { date: "Jan 30", free: 22800, pro: 37000 },
]

// Mock data for endpoint usage
const endpointData = [
  { endpoint: "/api/indicators/[symbol]/[timeframe]", calls: 450123 },
  { endpoint: "/api/alerts", calls: 320456 },
  { endpoint: "/api/watchlist", calls: 180789 },
  { endpoint: "/api/tier/symbols", calls: 120345 },
  { endpoint: "/api/dashboard/stats", calls: 95678 },
  { endpoint: "/api/user/profile", calls: 45234 },
  { endpoint: "/api/settings", calls: 32145 },
  { endpoint: "/api/notifications", calls: 28901 },
  { endpoint: "/api/historical/data", calls: 22567 },
  { endpoint: "/api/charts/data", calls: 15432 },
]

// Mock data for response time trend
const responseTimeData = [
  { date: "Jan 1", time: 235 },
  { date: "Jan 2", time: 242 },
  { date: "Jan 3", time: 238 },
  { date: "Jan 4", time: 245 },
  { date: "Jan 5", time: 240 },
  { date: "Jan 6", time: 248 },
  { date: "Jan 7", time: 243 },
  { date: "Jan 8", time: 250 },
  { date: "Jan 9", time: 245 },
  { date: "Jan 10", time: 252 },
  { date: "Jan 11", time: 247 },
  { date: "Jan 12", time: 255 },
  { date: "Jan 13", time: 250 },
  { date: "Jan 14", time: 258 },
  { date: "Jan 15", time: 253 },
  { date: "Jan 16", time: 248 },
  { date: "Jan 17", time: 243 },
  { date: "Jan 18", time: 240 },
  { date: "Jan 19", time: 238 },
  { date: "Jan 20", time: 235 },
  { date: "Jan 21", time: 233 },
  { date: "Jan 22", time: 230 },
  { date: "Jan 23", time: 228 },
  { date: "Jan 24", time: 225 },
  { date: "Jan 25", time: 223 },
  { date: "Jan 26", time: 220 },
  { date: "Jan 27", time: 218 },
  { date: "Jan 28", time: 215 },
  { date: "Jan 29", time: 213 },
  { date: "Jan 30", time: 245 },
]

// Mock data for detailed endpoint table
const detailedEndpointData = [
  {
    endpoint: "/api/indicators/[symbol]/[timeframe]",
    method: "GET",
    totalCalls: 450123,
    freeCalls: 180000,
    proCalls: 270123,
    avgResponseTime: 235,
    errorRate: 0.5,
  },
  {
    endpoint: "/api/alerts",
    method: "GET",
    totalCalls: 320456,
    freeCalls: 120000,
    proCalls: 200456,
    avgResponseTime: 189,
    errorRate: 0.8,
  },
  {
    endpoint: "/api/alerts",
    method: "POST",
    totalCalls: 85234,
    freeCalls: 30000,
    proCalls: 55234,
    avgResponseTime: 312,
    errorRate: 1.2,
  },
  {
    endpoint: "/api/watchlist",
    method: "GET",
    totalCalls: 180789,
    freeCalls: 80000,
    proCalls: 100789,
    avgResponseTime: 156,
    errorRate: 0.3,
  },
  {
    endpoint: "/api/watchlist",
    method: "POST",
    totalCalls: 45678,
    freeCalls: 15000,
    proCalls: 30678,
    avgResponseTime: 298,
    errorRate: 2.1,
  },
  {
    endpoint: "/api/tier/symbols",
    method: "GET",
    totalCalls: 120345,
    freeCalls: 120345,
    proCalls: 0,
    avgResponseTime: 98,
    errorRate: 0.1,
  },
  {
    endpoint: "/api/dashboard/stats",
    method: "GET",
    totalCalls: 95678,
    freeCalls: 35000,
    proCalls: 60678,
    avgResponseTime: 423,
    errorRate: 3.2,
  },
  {
    endpoint: "/api/user/profile",
    method: "GET",
    totalCalls: 45234,
    freeCalls: 18000,
    proCalls: 27234,
    avgResponseTime: 167,
    errorRate: 0.4,
  },
  {
    endpoint: "/api/user/profile",
    method: "PATCH",
    totalCalls: 12456,
    freeCalls: 5000,
    proCalls: 7456,
    avgResponseTime: 445,
    errorRate: 4.8,
  },
  {
    endpoint: "/api/settings",
    method: "GET",
    totalCalls: 32145,
    freeCalls: 12000,
    proCalls: 20145,
    avgResponseTime: 134,
    errorRate: 0.2,
  },
  {
    endpoint: "/api/notifications",
    method: "GET",
    totalCalls: 28901,
    freeCalls: 10000,
    proCalls: 18901,
    avgResponseTime: 201,
    errorRate: 0.6,
  },
  {
    endpoint: "/api/historical/data",
    method: "GET",
    totalCalls: 22567,
    freeCalls: 8000,
    proCalls: 14567,
    avgResponseTime: 678,
    errorRate: 5.6,
  },
  {
    endpoint: "/api/charts/data",
    method: "GET",
    totalCalls: 15432,
    freeCalls: 6000,
    proCalls: 9432,
    avgResponseTime: 245,
    errorRate: 1.8,
  },
  {
    endpoint: "/api/subscription",
    method: "GET",
    totalCalls: 8901,
    freeCalls: 3000,
    proCalls: 5901,
    avgResponseTime: 189,
    errorRate: 0.5,
  },
  {
    endpoint: "/api/billing",
    method: "GET",
    totalCalls: 5678,
    freeCalls: 0,
    proCalls: 5678,
    avgResponseTime: 234,
    errorRate: 0.9,
  },
]

type SortColumn = "totalCalls" | "freeCalls" | "proCalls" | "avgResponseTime" | "errorRate" | null
type SortDirection = "asc" | "desc"

export default function ApiUsageAnalyticsPage() {
  const [dateRange, setDateRange] = useState("30")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<SortColumn>("totalCalls")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const itemsPerPage = 15

  // Calculate statistics
  const totalCalls = 1234567
  const freeTierCalls = 456789
  const proTierCalls = 777778
  const avgResponseTime = 245
  const freePercentage = ((freeTierCalls / totalCalls) * 100).toFixed(0)
  const proPercentage = ((proTierCalls / totalCalls) * 100).toFixed(0)

  // Sorting logic
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const sortedData = [...detailedEndpointData].sort((a, b) => {
    if (!sortColumn) return 0
    const multiplier = sortDirection === "asc" ? 1 : -1
    return (a[sortColumn] - b[sortColumn]) * multiplier
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getMethodBadge = (method: string) => {
    const variants: Record<string, string> = {
      GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      PATCH: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    }
    return <Badge className={`${variants[method] || "bg-gray-100 text-gray-700"} border-0`}>{method}</Badge>
  }

  const getErrorRateBadge = (rate: number) => {
    if (rate < 1) {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
          {rate.toFixed(1)}%
        </Badge>
      )
    } else if (rate < 5) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
          {rate.toFixed(1)}%
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
          {rate.toFixed(1)}%
        </Badge>
      )
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Page Header */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{"Admin > API Usage"}</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-4xl font-bold text-foreground">API Usage Analytics</h1>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total API Calls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Total API Calls</p>
                  <p className="text-3xl font-bold text-foreground">{totalCalls.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    <span>+15.2% from last period</span>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FREE Tier Calls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">FREE Tier API Calls</p>
                  <p className="text-3xl font-bold text-foreground">{freeTierCalls.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{freePercentage}% of total</p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
                  <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PRO Tier Calls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">PRO Tier API Calls</p>
                  <p className="text-3xl font-bold text-foreground">{proTierCalls.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{proPercentage}% of total</p>
                </div>
                <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/30">
                  <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Response Time */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="text-3xl font-bold text-foreground">{avgResponseTime}ms</p>
                  <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <TrendingDown className="h-4 w-4" />
                    <span>-12ms from last period</span>
                  </div>
                </div>
                <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
                  <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Calls Over Time - Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">API Calls Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorFree" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="free"
                  stackId="1"
                  stroke="#9ca3af"
                  fill="url(#colorFree)"
                  name="FREE Tier"
                />
                <Area
                  type="monotone"
                  dataKey="pro"
                  stackId="1"
                  stroke="#2563eb"
                  fill="url(#colorPro)"
                  name="PRO Tier"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Endpoints - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top 10 Endpoints by Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={endpointData} layout="vertical" margin={{ left: 200 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} />
                <YAxis dataKey="endpoint" type="category" width={180} tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar dataKey="calls" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time Trend - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Response Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                  }}
                />
                <ReferenceLine y={500} stroke="#ef4444" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="time"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Avg Response Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detailed Usage Table */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Detailed Usage by Endpoint</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Endpoint</TableHead>
                      <TableHead className="font-semibold">Method</TableHead>
                      <TableHead
                        className="cursor-pointer text-right font-semibold"
                        onClick={() => handleSort("totalCalls")}
                      >
                        Total Calls {sortColumn === "totalCalls" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right font-semibold"
                        onClick={() => handleSort("freeCalls")}
                      >
                        FREE Tier {sortColumn === "freeCalls" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right font-semibold"
                        onClick={() => handleSort("proCalls")}
                      >
                        PRO Tier {sortColumn === "proCalls" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right font-semibold"
                        onClick={() => handleSort("avgResponseTime")}
                      >
                        Avg Response Time {sortColumn === "avgResponseTime" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right font-semibold"
                        onClick={() => handleSort("errorRate")}
                      >
                        Error Rate {sortColumn === "errorRate" && (sortDirection === "asc" ? "↑" : "↓")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{row.endpoint}</TableCell>
                        <TableCell>{getMethodBadge(row.method)}</TableCell>
                        <TableCell className="text-right">{row.totalCalls.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.freeCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.proCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{row.avgResponseTime}ms</TableCell>
                        <TableCell className="text-right">{getErrorRateBadge(row.errorRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} endpoints
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="h-8 w-8"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
