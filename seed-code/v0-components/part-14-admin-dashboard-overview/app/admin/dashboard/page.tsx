"use client"

import { useState } from "react"
import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users,
  UserCheck,
  Crown,
  DollarSign,
  Tag,
  Percent,
  RefreshCw,
  Home,
  Activity,
  AlertCircle,
  Handshake,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

export default function AdminDashboardPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic affiliate percentages
  const { discountPercent, commissionPercent, calculateDiscountedPrice, isLoading } = useAffiliateConfig()

  const [dateRange, setDateRange] = useState("last-30-days")

  // Mock data (replace with real API calls)
  const totalUsers = 1234
  const freeUsers = 892
  const proUsers = 342
  const proPrice = 29.0
  const monthlyRevenue = proUsers * proPrice

  // Revenue chart data
  const revenueData = [
    { month: "Month 1", revenue: 8500 },
    { month: "Month 2", revenue: 9200 },
    { month: "Month 3", revenue: 9918 },
  ]

  // User distribution data
  const distributionData = [
    { name: "FREE", value: freeUsers, percentage: 72.3 },
    { name: "PRO", value: proUsers, percentage: 27.7 },
  ]

  const CHART_COLORS = ["#9CA3AF", "#8B5CF6"]

  // Mock user activity data
  const recentUsers = [
    {
      id: 1,
      name: "John Doe",
      email: "john.doe@example.com",
      tier: "PRO",
      joinDate: "Dec 15, 2024",
      lastActive: "2 hours ago",
      avatar: "JD",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane.smith@example.com",
      tier: "FREE",
      joinDate: "Dec 14, 2024",
      lastActive: "5 hours ago",
      avatar: "JS",
    },
    {
      id: 3,
      name: "Mike Johnson",
      email: "mike.j@example.com",
      tier: "PRO",
      joinDate: "Dec 13, 2024",
      lastActive: "1 day ago",
      avatar: "MJ",
    },
    {
      id: 4,
      name: "Sarah Williams",
      email: "sarah.w@example.com",
      tier: "FREE",
      joinDate: "Dec 12, 2024",
      lastActive: "2 days ago",
      avatar: "SW",
    },
    {
      id: 5,
      name: "Tom Brown",
      email: "tom.brown@example.com",
      tier: "PRO",
      joinDate: "Dec 11, 2024",
      lastActive: "3 hours ago",
      avatar: "TB",
    },
    {
      id: 6,
      name: "Emily Davis",
      email: "emily.d@example.com",
      tier: "FREE",
      joinDate: "Dec 10, 2024",
      lastActive: "4 hours ago",
      avatar: "ED",
    },
    {
      id: 7,
      name: "David Miller",
      email: "david.m@example.com",
      tier: "PRO",
      joinDate: "Dec 9, 2024",
      lastActive: "1 day ago",
      avatar: "DM",
    },
    {
      id: 8,
      name: "Lisa Anderson",
      email: "lisa.a@example.com",
      tier: "FREE",
      joinDate: "Dec 8, 2024",
      lastActive: "2 days ago",
      avatar: "LA",
    },
    {
      id: 9,
      name: "James Wilson",
      email: "james.w@example.com",
      tier: "PRO",
      joinDate: "Dec 7, 2024",
      lastActive: "6 hours ago",
      avatar: "JW",
    },
    {
      id: 10,
      name: "Mary Taylor",
      email: "mary.t@example.com",
      tier: "FREE",
      joinDate: "Dec 6, 2024",
      lastActive: "3 days ago",
      avatar: "MT",
    },
  ]

  return (
    <div className="flex min-h-screen bg-[#f9fafb]">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 bg-white border-r border-[#e5e7eb] p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111827]">Admin Panel</h1>
        </div>
        <nav className="space-y-1">
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#2563eb] bg-[#eff6ff] rounded-lg border-l-4 border-[#2563eb]"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] rounded-lg"
          >
            <Users className="h-5 w-5" />
            Users
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] rounded-lg"
          >
            <Activity className="h-5 w-5" />
            API Usage
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] rounded-lg"
          >
            <AlertCircle className="h-5 w-5" />
            Error Logs
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] rounded-lg"
          >
            <Handshake className="h-5 w-5" />
            Affiliates
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] rounded-lg"
          >
            <Settings className="h-5 w-5" />
            Settings
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#6b7280] mb-2">
            <span>Admin</span>
            <span>&gt;</span>
            <span>Dashboard</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-[#111827]">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last-7-days">Last 7 days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 days</SelectItem>
                  <SelectItem value="last-90-days">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#6b7280] mb-1">Total Users</p>
                  <p className="text-3xl font-bold text-[#111827]">{totalUsers.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="h-4 w-4 text-[#16a34a]" />
                    <span className="text-sm text-[#16a34a]">+12.5% from last month</span>
                  </div>
                </div>
                <div className="bg-[#dbeafe] p-3 rounded-lg">
                  <Users className="h-6 w-6 text-[#2563eb]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FREE Tier Users */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#6b7280] mb-1">FREE Tier Users</p>
                  <p className="text-3xl font-bold text-[#111827]">{freeUsers.toLocaleString()}</p>
                  <p className="text-sm text-[#6b7280] mt-2">{((freeUsers / totalUsers) * 100).toFixed(1)}% of total</p>
                </div>
                <div className="bg-[#dcfce7] p-3 rounded-lg">
                  <UserCheck className="h-6 w-6 text-[#16a34a]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PRO Tier Users */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#6b7280] mb-1">PRO Tier Users</p>
                  <p className="text-3xl font-bold text-[#111827]">{proUsers.toLocaleString()}</p>
                  <p className="text-sm text-[#6b7280] mt-2">{((proUsers / totalUsers) * 100).toFixed(1)}% of total</p>
                </div>
                <div className="bg-[#f3e8ff] p-3 rounded-lg">
                  <Crown className="h-6 w-6 text-[#9333ea]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#6b7280] mb-1">Monthly Revenue (MRR)</p>
                  <p className="text-3xl font-bold text-[#111827]">${monthlyRevenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="h-4 w-4 text-[#16a34a]" />
                    <span className="text-sm text-[#16a34a]">+8.2% from last month</span>
                  </div>
                </div>
                <div className="bg-[#fef3c7] p-3 rounded-lg">
                  <DollarSign className="h-6 w-6 text-[#ca8a04]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Monthly Recurring Revenue (MRR)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    formatter={(value) => `$${value.toLocaleString()}`}
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} dot={{ fill: "#2563EB" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">User Distribution by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} users (${props.payload.percentage}%)`,
                      props.payload.name,
                    ]}
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Affiliate Program Stats */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#111827] mb-4">Affiliate Program Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Discount Rate */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-[#dcfce7] p-3 rounded-lg">
                    <Tag className="h-6 w-6 text-[#16a34a]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Current Affiliate Discount</p>
                    {isLoading ? (
                      <div className="h-8 w-20 bg-[#e5e7eb] animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-[#16a34a]">{discountPercent}%</p>
                    )}
                    <p className="text-sm text-[#6b7280] mt-1">Applied to PRO monthly subscriptions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Commission Rate */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-[#f3e8ff] p-3 rounded-lg">
                    <Percent className="h-6 w-6 text-[#9333ea]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Affiliate Commission Rate</p>
                    {isLoading ? (
                      <div className="h-8 w-20 bg-[#e5e7eb] animate-pulse rounded" />
                    ) : (
                      <p className="text-2xl font-bold text-[#9333ea]">{commissionPercent}%</p>
                    )}
                    <p className="text-sm text-[#6b7280] mt-1">Earned per PRO upgrade</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Affiliates */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-[#dbeafe] p-3 rounded-lg">
                    <Users className="h-6 w-6 text-[#2563eb]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#6b7280] mb-1">Active Affiliates</p>
                    <p className="text-2xl font-bold text-[#2563eb]">87</p>
                    <p className="text-sm text-[#16a34a] mt-1">12 new this month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent User Activity Table */}
        <div>
          <h2 className="text-2xl font-bold text-[#111827] mb-4">Recent User Activity</h2>
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Join Date</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-[#f9fafb]">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#dbeafe] flex items-center justify-center text-[#2563eb] font-semibold text-sm">
                              {user.avatar}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{user.name}</p>
                              <p className="text-sm text-[#6b7280]">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.tier === "PRO"
                                ? "bg-gradient-to-r from-[#2563eb] to-[#9333ea] text-white"
                                : "bg-[#9ca3af] text-white"
                            }
                          >
                            {user.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#6b7280]">{user.joinDate}</TableCell>
                        <TableCell className="text-sm text-[#6b7280]">{user.lastActive}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#6b7280]">Showing 1-10 of {totalUsers.toLocaleString()} users</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button variant="outline" size="sm">
                    1
                  </Button>
                  <Button variant="outline" size="sm">
                    2
                  </Button>
                  <Button variant="outline" size="sm">
                    3
                  </Button>
                  <Button variant="outline" size="sm">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
