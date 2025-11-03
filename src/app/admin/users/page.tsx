"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Users, MoreVertical, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { User } from "@/types"

export default function UsersPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "user" as "admin" | "community_owner" | "user",
  })

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch users
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchUsers()
    }
  }, [userProfile])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
      setFilteredUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = users.filter(user =>
        user.email?.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.role?.toLowerCase().includes(query)
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, users])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({ 
            role: formData.role,
            first_name: formData.firstName,
            last_name: formData.lastName
          })
          .eq('id', editingUser.id)

        if (error) throw error
        toast.success("User updated successfully!")
      } else {
        // Create new user (invite)
        const { error } = await supabase.auth.admin.inviteUserByEmail(formData.email, {
          data: { 
            role: formData.role,
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        })

        if (error) throw error
        toast.success("User invitation sent successfully!")
      }

      // Reset form and close dialog
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "user",
      })
      setEditingUser(null)
      setDialogOpen(false)
      
      // Refresh list
      fetchUsers()
    } catch (error) {
      console.error('Error saving user:', error)
      toast.error("Failed to save user")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email || "",
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      role: user.role || "user",
    })
    setDialogOpen(true)
  }


  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId)

      if (error) throw error
      toast.success("User deleted successfully!")
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error("Failed to delete user")
    }
  }

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumb items={[{ label: "Users", icon: Users }]} />
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingUser(null)
                  setFormData({
                    email: "",
                    firstName: "",
                    lastName: "",
                    role: "user",
                  })
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Edit User' : 'Invite New User'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                    disabled={!!editingUser}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as "admin" | "community_owner" | "user" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="community_owner">Community Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingUser ? 'Updating...' : 'Inviting...'}
                      </>
                    ) : (
                      editingUser ? 'Update' : 'Send Invitation'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false)
                      setEditingUser(null)
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
        </div>

        {/* Users - Cards on Mobile, Table on Desktop */}
        {filteredUsers.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Users className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No users found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery 
                ? "No users match your search"
                : "Invite your first user to get started"
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filteredUsers.map((user) => (
                <ContextMenu key={user.id}>
                  <ContextMenuTrigger asChild>
                    <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 cursor-context-menu">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-lg">{user.email}</h3>
                          <p className="text-white/60 text-sm">
                            {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username || 'No name provided'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(user.id)}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Role:</span>
                          <span className="text-white text-sm capitalize">{user.role || 'user'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Joined:</span>
                          <span className="text-white text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleEdit(user)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit User
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onClick={() => handleDelete(user.id)}
                      className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete User
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <ContextMenu key={user.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username || '-'}</TableCell>
                          <TableCell className="capitalize">{user.role || 'user'}</TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(user.id)}
                                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleEdit(user)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => handleDelete(user.id)}
                          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
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
