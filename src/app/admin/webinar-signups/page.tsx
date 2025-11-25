"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Users, Search, Loader2, Calendar, Phone } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"

interface WebinarSignup {
  id: string
  first_name: string
  last_name: string
  country_code: string
  whatsapp_number: string
  signup_date: string
  created_at: string
}

export default function WebinarSignupsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [signups, setSignups] = useState<WebinarSignup[]>([])
  const [filteredSignups, setFilteredSignups] = useState<WebinarSignup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch signups
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchSignups()
    }
  }, [userProfile])

  const fetchSignups = async () => {
    try {
      const { data, error } = await supabase
        .from('webinar_signups')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSignups(data || [])
      setFilteredSignups(data || [])
    } catch (error) {
      console.error('Error fetching webinar signups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter signups based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSignups(signups)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = signups.filter(signup =>
        signup.first_name?.toLowerCase().includes(query) ||
        signup.last_name?.toLowerCase().includes(query) ||
        signup.whatsapp_number?.includes(query) ||
        signup.country_code?.includes(query)
      )
      setFilteredSignups(filtered)
    }
  }, [searchQuery, signups])

  const formatWhatsAppNumber = (countryCode: string, number: string) => {
    return `${countryCode} ${number}`
  }

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 space-y-6">
          <Breadcrumb items={[{ label: "Webinar Signups", icon: Users }]} />
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <Breadcrumb items={[{ label: "Webinar Signups", icon: Users }]} />

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by name or WhatsApp number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/80">Total Signups</p>
                <p className="text-xl sm:text-2xl font-bold text-white mt-2">{signups.length}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/80">Today</p>
                <p className="text-xl sm:text-2xl font-bold text-white mt-2">
                  {signups.filter(s => {
                    const signupDate = new Date(s.signup_date)
                    const today = new Date()
                    return signupDate.toDateString() === today.toDateString()
                  }).length}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/80">This Week</p>
                <p className="text-xl sm:text-2xl font-bold text-white mt-2">
                  {signups.filter(s => {
                    const signupDate = new Date(s.signup_date)
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return signupDate >= weekAgo
                  }).length}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Signups Table */}
        {filteredSignups.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Users className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No signups found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery 
                ? "No signups match your search"
                : "No webinar signups yet"
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filteredSignups.map((signup) => (
                <div
                  key={signup.id}
                  className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-white text-lg">
                        {signup.first_name} {signup.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4 text-white/60" />
                        <p className="text-white/60 text-sm">
                          {formatWhatsAppNumber(signup.country_code, signup.whatsapp_number)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">Signup Date:</span>
                      <span className="text-white text-sm">
                        {new Date(signup.signup_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">Registered:</span>
                      <span className="text-white text-sm">
                        {new Date(signup.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Signup Date</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSignups.map((signup) => (
                    <TableRow key={signup.id}>
                      <TableCell className="font-medium">
                        {signup.first_name} {signup.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-white/60" />
                          <span>{formatWhatsAppNumber(signup.country_code, signup.whatsapp_number)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(signup.signup_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(signup.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}



