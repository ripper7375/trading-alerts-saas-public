"use client"

import { useState } from "react"
import { useAffiliateConfig } from "@/lib/hooks/useAffiliateConfig"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  MoreHorizontal,
  Eye,
  Gift,
  Ban,
  Trash,
  Search,
  Plus,
  Users,
  TrendingUp,
  DollarSign,
  Percent,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"

interface Affiliate {
  id: string
  name: string
  email: string
  country: string
  countryFlag: string
  codesActive: number
  codesTotal: number
  codesUsed: number
  status: "active" | "pending" | "suspended" | "deleted"
  avatar?: string
}

// Mock data
const mockAffiliates: Affiliate[] = [
  {
    id: "1",
    name: "Rajesh Kumar",
    email: "rajesh@example.com",
    country: "IN",
    countryFlag: "🇮🇳",
    codesActive: 12,
    codesTotal: 15,
    codesUsed: 8,
    status: "active",
  },
  {
    id: "2",
    name: "Oluwaseun Adeyemi",
    email: "oluwaseun@example.com",
    country: "NG",
    countryFlag: "🇳🇬",
    codesActive: 8,
    codesTotal: 10,
    codesUsed: 5,
    status: "active",
  },
  {
    id: "3",
    name: "Ahmed Hassan",
    email: "ahmed@example.com",
    country: "PK",
    countryFlag: "🇵🇰",
    codesActive: 5,
    codesTotal: 20,
    codesUsed: 12,
    status: "pending",
  },
  {
    id: "4",
    name: "Nguyen Van Tuan",
    email: "nguyen@example.com",
    country: "VN",
    countryFlag: "🇻🇳",
    codesActive: 18,
    codesTotal: 20,
    codesUsed: 15,
    status: "active",
  },
  {
    id: "5",
    name: "Budi Santoso",
    email: "budi@example.com",
    country: "ID",
    countryFlag: "🇮🇩",
    codesActive: 3,
    codesTotal: 10,
    codesUsed: 2,
    status: "suspended",
  },
  {
    id: "6",
    name: "Somchai Patel",
    email: "somchai@example.com",
    country: "TH",
    countryFlag: "🇹🇭",
    codesActive: 10,
    codesTotal: 15,
    codesUsed: 9,
    status: "active",
  },
  {
    id: "7",
    name: "Thabo Mokoena",
    email: "thabo@example.com",
    country: "ZA",
    countryFlag: "🇿🇦",
    codesActive: 0,
    codesTotal: 5,
    codesUsed: 0,
    status: "deleted",
  },
  {
    id: "8",
    name: "Mehmet Yilmaz",
    email: "mehmet@example.com",
    country: "TR",
    countryFlag: "🇹🇷",
    codesActive: 14,
    codesTotal: 15,
    codesUsed: 11,
    status: "active",
  },
]

export default function AdminAffiliatesPage() {
  // ✅ CRITICAL: Use SystemConfig hook
  const { commissionPercent, calculateDiscountedPrice } = useAffiliateConfig()

  const regularPrice = 29.0
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = discountedPrice * (commissionPercent / 100)

  // State
  const [affiliates, setAffiliates] = useState<Affiliate[]>(mockAffiliates)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Modals
  const [distributeCodesModal, setDistributeCodesModal] = useState(false)
  const [suspendModal, setSuspendModal] = useState(false)
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null)
  const [codeCount, setCodeCount] = useState(10)
  const [reason, setReason] = useState("")
  const [suspendReason, setSuspendReason] = useState("")

  // Calculate stats
  const totalAffiliates = affiliates.length
  const activeThisMonth = affiliates.filter((a) => a.status === "active").length
  const totalPending = affiliates.reduce((sum, affiliate) => {
    return sum + affiliate.codesUsed * commissionAmount
  }, 0)

  // Filter affiliates
  const filteredAffiliates = affiliates.filter((affiliate) => {
    const matchesSearch =
      affiliate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      affiliate.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || affiliate.status === statusFilter
    const matchesCountry = countryFilter === "all" || affiliate.country === countryFilter

    return matchesSearch && matchesStatus && matchesCountry
  })

  // Pagination
  const totalPages = Math.ceil(filteredAffiliates.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAffiliates = filteredAffiliates.slice(startIndex, endIndex)

  const getStatusBadge = (status: Affiliate["status"]) => {
    const variants = {
      active: "bg-green-100 text-green-700 hover:bg-green-100",
      pending: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
      suspended: "bg-red-100 text-red-700 hover:bg-red-100",
      deleted: "bg-gray-100 text-gray-700 hover:bg-gray-100",
    }

    const labels = {
      active: "Active",
      pending: "Pending Verification",
      suspended: "Suspended",
      deleted: "Deleted",
    }

    return <Badge className={variants[status]}>{labels[status]}</Badge>
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleDistributeCodes = () => {
    console.log(`Distributing ${codeCount} codes to ${selectedAffiliate?.name}`)
    setDistributeCodesModal(false)
    setCodeCount(10)
    setReason("")
  }

  const handleSuspend = () => {
    console.log(`Suspending ${selectedAffiliate?.name}: ${suspendReason}`)
    setSuspendModal(false)
    setSuspendReason("")
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setCountryFilter("all")
    setPaymentFilter("all")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-2">Admin &gt; Affiliates</div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Affiliate Management</h1>
          <Button variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Add Affiliate
          </Button>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Affiliates</CardTitle>
              <Users className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAffiliates}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active This Month</CardTitle>
              <TrendingUp className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeThisMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Commission Payout</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Current Commission Rate</CardTitle>
              <Percent className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{commissionPercent}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  <SelectItem value="IN">🇮🇳 India</SelectItem>
                  <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                  <SelectItem value="PK">🇵🇰 Pakistan</SelectItem>
                  <SelectItem value="VN">🇻🇳 Vietnam</SelectItem>
                  <SelectItem value="ID">🇮🇩 Indonesia</SelectItem>
                  <SelectItem value="TH">🇹🇭 Thailand</SelectItem>
                  <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                  <SelectItem value="TR">🇹🇷 Turkey</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="payoneer">Payoneer</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Codes</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAffiliates.map((affiliate) => {
                    const pendingEarnings = affiliate.codesUsed * commissionAmount
                    const totalEarnings = affiliate.codesTotal * commissionAmount
                    const progressPercent = (affiliate.codesActive / affiliate.codesTotal) * 100

                    return (
                      <TableRow key={affiliate.id}>
                        <TableCell>
                          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-medium text-sm">
                            {getInitials(affiliate.name)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{affiliate.name}</TableCell>
                        <TableCell className="text-sm text-gray-600">{affiliate.email}</TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-1">
                            {affiliate.countryFlag} {affiliate.country}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {affiliate.codesActive}/{affiliate.codesTotal}
                            </div>
                            <Progress value={progressPercent} className="h-1 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-1">
                            <div className="font-medium">
                              ${pendingEarnings.toFixed(2)} / ${totalEarnings.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">Pending / Total</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(affiliate.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAffiliate(affiliate)
                                  setDistributeCodesModal(true)
                                }}
                              >
                                <Gift className="w-4 h-4 mr-2" />
                                Distribute Codes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedAffiliate(affiliate)
                                  setSuspendModal(true)
                                }}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Suspend Account
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAffiliates.length)} of {filteredAffiliates.length}{" "}
                affiliates
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribute Codes Modal */}
        <Dialog open={distributeCodesModal} onOpenChange={setDistributeCodesModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Distribute Bonus Codes</DialogTitle>
              <DialogDescription>Distribute additional referral codes to {selectedAffiliate?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code-count">Code Count</Label>
                <Input
                  id="code-count"
                  type="number"
                  min="1"
                  max="100"
                  value={codeCount}
                  onChange={(e) => setCodeCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="manual">Manual Distribution</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input id="expiry" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDistributeCodesModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleDistributeCodes}>Distribute Codes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Affiliate Modal */}
        <Dialog open={suspendModal} onOpenChange={setSuspendModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suspend Affiliate Account</DialogTitle>
              <DialogDescription>This will suspend all active codes for {selectedAffiliate?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">Reason (Required)</Label>
                <Textarea
                  id="suspend-reason"
                  placeholder="Please provide a reason for suspension..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">⚠️ This will suspend all active codes for this affiliate</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSuspendModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim()}>
                Confirm Suspension
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
