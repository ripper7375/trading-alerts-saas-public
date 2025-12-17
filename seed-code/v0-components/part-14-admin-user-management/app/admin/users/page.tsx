"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Download, MoreHorizontal, Eye, Edit, Ban, Trash, UserX, ChevronLeft, ChevronRight } from "lucide-react"

// User interface
interface User {
  id: string
  name: string | null
  email: string
  tier: "FREE" | "PRO"
  joinDate: Date
  lastActive: Date
  subscriptionStatus: "ACTIVE" | "CANCELLED" | "TRIAL" | "FREE"
  avatarUrl?: string
}

// Mock data - 20 sample users
const mockUsers: User[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-15"),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/diverse-woman-portrait.png",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael.chen@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-01"),
    lastActive: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/man.jpg",
  },
  {
    id: "3",
    name: null,
    email: "anonymous.user@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-10"),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    subscriptionStatus: "FREE",
  },
  {
    id: "4",
    name: "Emma Watson",
    email: "emma.watson@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-20"),
    lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    subscriptionStatus: "CANCELLED",
    avatarUrl: "/professional-woman.png",
  },
  {
    id: "5",
    name: "James Rodriguez",
    email: "james.rodriguez@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-14"),
    lastActive: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    subscriptionStatus: "TRIAL",
    avatarUrl: "/man-business.jpg",
  },
  {
    id: "6",
    name: "Olivia Martinez",
    email: "olivia.martinez@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-05"),
    lastActive: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    subscriptionStatus: "FREE",
  },
  {
    id: "7",
    name: "Liam Brown",
    email: "liam.brown@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-25"),
    lastActive: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/man-casual.jpg",
  },
  {
    id: "8",
    name: "Sophia Lee",
    email: "sophia.lee@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-08"),
    lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/woman-asian.jpg",
  },
  {
    id: "9",
    name: "Noah Wilson",
    email: "noah.wilson@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-12"),
    lastActive: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
    subscriptionStatus: "FREE",
  },
  {
    id: "10",
    name: "Ava Garcia",
    email: "ava.garcia@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-30"),
    lastActive: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/woman-hispanic.jpg",
  },
  {
    id: "11",
    name: "Ethan Anderson",
    email: "ethan.anderson@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-18"),
    lastActive: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    subscriptionStatus: "TRIAL",
    avatarUrl: "/man-young.jpg",
  },
  {
    id: "12",
    name: null,
    email: "test.account@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-15"),
    lastActive: new Date(Date.now() - 120 * 60 * 60 * 1000), // 5 days ago
    subscriptionStatus: "FREE",
  },
  {
    id: "13",
    name: "Isabella Thomas",
    email: "isabella.thomas@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-03"),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/woman-elegant.jpg",
  },
  {
    id: "14",
    name: "Mason Taylor",
    email: "mason.taylor@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-08"),
    lastActive: new Date(Date.now() - 36 * 60 * 60 * 1000), // 1.5 days ago
    subscriptionStatus: "FREE",
  },
  {
    id: "15",
    name: "Mia Moore",
    email: "mia.moore@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-22"),
    lastActive: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
    subscriptionStatus: "CANCELLED",
    avatarUrl: "/woman-redhead.jpg",
  },
  {
    id: "16",
    name: "Lucas Jackson",
    email: "lucas.jackson@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-12"),
    lastActive: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/man-with-stylish-glasses.png",
  },
  {
    id: "17",
    name: "Charlotte White",
    email: "charlotte.white@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-20"),
    lastActive: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    subscriptionStatus: "FREE",
  },
  {
    id: "18",
    name: "Benjamin Harris",
    email: "benjamin.harris@example.com",
    tier: "PRO",
    joinDate: new Date("2024-02-06"),
    lastActive: new Date(Date.now() - 14 * 60 * 60 * 1000), // 14 hours ago
    subscriptionStatus: "TRIAL",
    avatarUrl: "/man-beard.jpg",
  },
  {
    id: "19",
    name: "Amelia Martin",
    email: "amelia.martin@example.com",
    tier: "PRO",
    joinDate: new Date("2024-01-28"),
    lastActive: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    subscriptionStatus: "ACTIVE",
    avatarUrl: "/woman-blonde.jpg",
  },
  {
    id: "20",
    name: "Alexander Thompson",
    email: "alexander.thompson@example.com",
    tier: "FREE",
    joinDate: new Date("2024-03-18"),
    lastActive: new Date(Date.now() - 96 * 60 * 60 * 1000), // 4 days ago
    subscriptionStatus: "FREE",
  },
]

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [tierFilter, setTierFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [joinDateFilter, setJoinDateFilter] = useState("all")
  const [sortColumn, setSortColumn] = useState<"name" | "email" | "joinDate">("joinDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Format date helper
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  }

  // Format last active helper
  const formatLastActive = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`
    return `${days} day${days !== 1 ? "s" : ""} ago`
  }

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = mockUsers

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) => user.email.toLowerCase().includes(query) || user.name?.toLowerCase().includes(query),
      )
    }

    // Apply tier filter
    if (tierFilter !== "all") {
      filtered = filtered.filter((user) => user.tier === tierFilter)
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.subscriptionStatus === statusFilter)
    }

    // Apply join date filter
    if (joinDateFilter !== "all") {
      const now = new Date()
      const daysMap: { [key: string]: number } = {
        "7days": 7,
        "30days": 30,
        "90days": 90,
      }
      const days = daysMap[joinDateFilter]
      if (days) {
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        filtered = filtered.filter((user) => user.joinDate >= cutoffDate)
      }
    }

    // Sort users
    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn]
      let bVal: any = b[sortColumn]

      if (sortColumn === "name") {
        aVal = a.name?.toLowerCase() || ""
        bVal = b.name?.toLowerCase() || ""
      } else if (sortColumn === "email") {
        aVal = a.email.toLowerCase()
        bVal = b.email.toLowerCase()
      } else if (sortColumn === "joinDate") {
        aVal = a.joinDate.getTime()
        bVal = b.joinDate.getTime()
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return filtered
  }, [searchQuery, tierFilter, statusFilter, joinDateFilter, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage)
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("")
    setTierFilter("all")
    setStatusFilter("all")
    setJoinDateFilter("all")
    setCurrentPage(1)
  }

  // Toggle sort
  const toggleSort = (column: "name" | "email" | "joinDate") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Handle export CSV
  const handleExportCSV = () => {
    console.log("Exporting CSV...")
    // Export logic would go here
  }

  // Get initials from email
  const getInitials = (email: string, name: string | null) => {
    if (name) {
      const names = name.split(" ")
      return names
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Admin &gt; Users</p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-4xl font-bold text-gray-900">User Management</h1>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tier Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="FREE">FREE Only</SelectItem>
                  <SelectItem value="PRO">PRO Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="FREE">Free</SelectItem>
                </SelectContent>
              </Select>

              <Select value={joinDateFilter} onValueChange={setJoinDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Join Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="ghost" onClick={clearFilters} className="text-sm">
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {paginatedUsers.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <UserX className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No users found</h3>
              <p className="text-sm text-gray-600 mb-4">Try adjusting your filters or search query</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Avatar</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => toggleSort("name")}>
                        <div className="flex items-center gap-1">
                          Name
                          {sortColumn === "name" && (
                            <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => toggleSort("email")}>
                        <div className="flex items-center gap-1">
                          Email
                          {sortColumn === "email" && (
                            <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => toggleSort("joinDate")}>
                        <div className="flex items-center gap-1">
                          Join Date
                          {sortColumn === "joinDate" && (
                            <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user, index) => (
                      <TableRow key={user.id} className={`hover:bg-gray-50 ${index % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                        <TableCell>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name || user.email} />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {getInitials(user.email, user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-gray-900">{user.name || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{user.email}</TableCell>
                        <TableCell>
                          {user.tier === "PRO" ? (
                            <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                              PRO
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                              FREE
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(user.joinDate)}</TableCell>
                        <TableCell className="text-sm text-gray-600">{formatLastActive(user.lastActive)}</TableCell>
                        <TableCell>
                          {user.subscriptionStatus === "ACTIVE" && (
                            <Badge className="bg-green-100 text-green-700 border-0">Active</Badge>
                          )}
                          {user.subscriptionStatus === "CANCELLED" && (
                            <Badge className="bg-red-100 text-red-700 border-0">Cancelled</Badge>
                          )}
                          {user.subscriptionStatus === "TRIAL" && (
                            <Badge className="bg-yellow-100 text-yellow-700 border-0">Trial</Badge>
                          )}
                          {user.subscriptionStatus === "FREE" && (
                            <Badge className="bg-gray-100 text-gray-700 border-0">Free</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend Account
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash className="mr-2 h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-4 p-4">
                {paginatedUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name || user.email} />
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {getInitials(user.email, user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{user.name || "—"}</p>
                          <p className="text-sm text-gray-600 truncate max-w-[200px]">{user.email}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Ban className="mr-2 h-4 w-4" />
                            Suspend Account
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Tier</p>
                        {user.tier === "PRO" ? (
                          <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 mt-1">
                            PRO
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700 mt-1">
                            FREE
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        {user.subscriptionStatus === "ACTIVE" && (
                          <Badge className="bg-green-100 text-green-700 border-0 mt-1">Active</Badge>
                        )}
                        {user.subscriptionStatus === "CANCELLED" && (
                          <Badge className="bg-red-100 text-red-700 border-0 mt-1">Cancelled</Badge>
                        )}
                        {user.subscriptionStatus === "TRIAL" && (
                          <Badge className="bg-yellow-100 text-yellow-700 border-0 mt-1">Trial</Badge>
                        )}
                        {user.subscriptionStatus === "FREE" && (
                          <Badge className="bg-gray-100 text-gray-700 border-0 mt-1">Free</Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">Join Date</p>
                        <p className="text-gray-900 mt-1">{formatDate(user.joinDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Active</p>
                        <p className="text-gray-900 mt-1">{formatLastActive(user.lastActive)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="border-t px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1}-
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedUsers.length)} of{" "}
                  {filteredAndSortedUsers.length} users
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={currentPage === pageNum ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
