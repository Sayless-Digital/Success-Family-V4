"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Tag,
  Sparkles,
  Search,
  RefreshCw,
  Loader2,
  Star,
  PauseCircle,
  PlayCircle,
  Hash,
  Filter,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
import type { Topic } from "@/types"

type TopicWithUsage = Topic & { usage_count: number }

const emptyForm = {
  label: "",
  slug: "",
  description: "",
  is_featured: false,
  is_active: true,
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "")

export default function TopicCurationPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()

  const [topics, setTopics] = useState<TopicWithUsage[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all")
  const [featuredOnly, setFeaturedOnly] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<TopicWithUsage | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== "admin")) {
      router.push("/")
    }
  }, [user, userProfile, isLoading, router])

  useEffect(() => {
    if (userProfile?.role === "admin") {
      fetchTopics()
    }
  }, [userProfile])

  const fetchTopics = async () => {
    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from("topics")
        .select("*, post_topics:post_topics(count)")
        .order("label", { ascending: true })

      if (error) throw error

      const normalized: TopicWithUsage[] =
        data?.map((topic) => ({
          ...(topic as Topic),
          usage_count: Array.isArray((topic as any).post_topics)
            ? Number((topic as any).post_topics[0]?.count ?? 0)
            : 0,
        })) ?? []

      setTopics(normalized)
    } catch (error) {
      console.error("Failed to load topics", error)
      toast.error("Unable to fetch topics right now.")
    } finally {
      setIsFetching(false)
    }
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingTopic(null)
    setSlugManuallyEdited(false)
  }

  const handleOpenCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (topic: TopicWithUsage) => {
    setEditingTopic(topic)
    setFormData({
      label: topic.label,
      slug: topic.slug,
      description: topic.description ?? "",
      is_featured: topic.is_featured ?? false,
      is_active: topic.is_active ?? true,
    })
    setSlugManuallyEdited(true)
    setDialogOpen(true)
  }

  const handleFormChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "label" && !slugManuallyEdited) {
        next.slug = slugify(String(value))
      }
      return next
    })
  }

  const handleSlugInput = (value: string) => {
    setSlugManuallyEdited(true)
    setFormData((prev) => ({ ...prev, slug: slugify(value) }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formData.label.trim()) {
      toast.error("Label is required.")
      return
    }

    if (!formData.slug.trim()) {
      toast.error("Slug is required.")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        label: formData.label.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() ? formData.description.trim() : null,
        is_featured: formData.is_featured,
        is_active: formData.is_active,
      }

      if (editingTopic) {
        const { error } = await supabase.from("topics").update(payload).eq("id", editingTopic.id)
        if (error) throw error
        toast.success("Topic updated")
      } else {
        const insertPayload = {
          ...payload,
          created_by: user?.id ?? null,
        }
        const { error } = await supabase.from("topics").insert(insertPayload)
        if (error) throw error
        toast.success("Topic created")
      }

      setDialogOpen(false)
      resetForm()
      fetchTopics()
    } catch (error: any) {
      console.error("Failed to save topic", error)
      toast.error(error?.message || "Unable to save topic.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (topic: TopicWithUsage) => {
    try {
      const { error } = await supabase
        .from("topics")
        .update({ is_active: !topic.is_active })
        .eq("id", topic.id)
      if (error) throw error
      toast.success(`Topic ${topic.is_active ? "archived" : "re-activated"}`)
      fetchTopics()
    } catch (error) {
      console.error("Failed to toggle topic", error)
      toast.error("Unable to update topic status.")
    }
  }

  const handleToggleFeatured = async (topic: TopicWithUsage) => {
    try {
      const { error } = await supabase
        .from("topics")
        .update({ is_featured: !topic.is_featured })
        .eq("id", topic.id)
      if (error) throw error
      toast.success(topic.is_featured ? "Removed from featured" : "Highlighted as featured")
      fetchTopics()
    } catch (error) {
      console.error("Failed to toggle featured flag", error)
      toast.error("Unable to update featured state.")
    }
  }

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      if (statusFilter === "active" && !topic.is_active) return false
      if (statusFilter === "archived" && topic.is_active) return false
      if (featuredOnly && !topic.is_featured) return false

      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return (
        topic.label.toLowerCase().includes(query) ||
        topic.slug.toLowerCase().includes(query) ||
        (topic.description ?? "").toLowerCase().includes(query)
      )
    })
  }, [topics, statusFilter, featuredOnly, searchQuery])

  const stats = useMemo(() => {
    const total = topics.length
    const active = topics.filter((topic) => topic.is_active).length
    const featured = topics.filter((topic) => topic.is_featured).length
    const totalUsage = topics.reduce((sum, topic) => sum + topic.usage_count, 0)

    return { total, active, featured, totalUsage }
  }, [topics])

  if (!user || userProfile?.role !== "admin") {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumb items={[{ label: "Topic Curation", icon: Tag }]} />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="text-white border-white/30 hover:bg-white/20"
              onClick={fetchTopics}
              disabled={isFetching}
            >
              {isFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </span>
              )}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => (open ? handleOpenCreate() : setDialogOpen(open))}>
              <DialogTrigger asChild>
                <Button className="bg-white/20 text-white hover:bg-white/30">
                  <Sparkles className="h-4 w-4 mr-2" />
                  New Topic
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background/95 backdrop-blur-md border border-white/20">
                <DialogHeader>
                  <DialogTitle>{editingTopic ? "Edit Topic" : "Create Topic"}</DialogTitle>
                  <DialogDescription>
                    Craft platform-wide hashtags that power discovery, personalization, and moderation.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="label">Label</Label>
                    <Input
                      id="label"
                      value={formData.label}
                      onChange={(event) => handleFormChange("label", event.target.value)}
                      placeholder="e.g. Community Building"
                      className="text-white placeholder:text-white/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(event) => handleSlugInput(event.target.value)}
                      placeholder="community-building"
                      className="text-white placeholder:text-white/50"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(event) => handleFormChange("description", event.target.value)}
                      placeholder="Short blurb that helps members understand when to use this topic."
                      className="text-white placeholder:text-white/50 min-h-[110px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label
                      htmlFor="is_featured"
                      className="flex items-center justify-between rounded-lg border border-white/20 px-4 py-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">Featured</p>
                        <p className="text-xs text-white/60">Surface in discovery panels</p>
                      </div>
                      <Checkbox
                        id="is_featured"
                        checked={formData.is_featured}
                        onCheckedChange={(checked) => handleFormChange("is_featured", Boolean(checked))}
                        className="h-5 w-5 rounded-full border-white/40 data-[state=checked]:bg-white/20"
                      />
                    </label>
                    <label
                      htmlFor="is_active"
                      className="flex items-center justify-between rounded-lg border border-white/20 px-4 py-3 cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">Active</p>
                        <p className="text-xs text-white/60">Hidden topics stay archived</p>
                      </div>
                      <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => handleFormChange("is_active", Boolean(checked))}
                        className="h-5 w-5 rounded-full border-white/40 data-[state=checked]:bg-white/20"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button type="submit" className="flex-1" disabled={isSaving}>
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving
                        </span>
                      ) : (
                        <span>{editingTopic ? "Update Topic" : "Create Topic"}</span>
                      )}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-lg bg-white/10 p-4 border border-white/20">
            <p className="text-white/70 text-sm">Total Topics</p>
            <p className="text-3xl font-semibold text-white mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-4 border border-white/20">
            <p className="text-white/70 text-sm">Active</p>
            <p className="text-3xl font-semibold text-white mt-1">{stats.active}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-4 border border-white/20">
            <p className="text-white/70 text-sm">Featured</p>
            <p className="text-3xl font-semibold text-white mt-1">{stats.featured}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-4 border border-white/20">
            <p className="text-white/70 text-sm">Post Mentions</p>
            <p className="text-3xl font-semibold text-white mt-1">{stats.totalUsage}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <InputGroup className="bg-white/5 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search topics by name, slug, or description..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>

            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "archived") => setStatusFilter(value)}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={featuredOnly ? "default" : "outline"}
              className={cn(
                "justify-start gap-2",
                featuredOnly ? "bg-white/20 text-white" : "text-white border-white/30 hover:bg-white/20"
              )}
              onClick={() => setFeaturedOnly((prev) => !prev)}
            >
              <Star className="h-4 w-4" />
              {featuredOnly ? "Showing featured only" : "Show only featured"}
            </Button>
          </div>
        </div>

        {/* Topic list */}
        {isFetching ? (
          <div className="rounded-lg bg-white/10 border border-white/20 p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/70 mx-auto mb-4" />
            <p className="text-white/80">Loading curated topics...</p>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="rounded-lg bg-white/10 border border-white/20 p-12 text-center space-y-2">
            <Filter className="h-10 w-10 text-white/50 mx-auto" />
            <p className="text-white font-medium">No topics match your filters</p>
            <p className="text-white/60 text-sm">Adjust the filters or create a new topic.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTopics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-xl border border-white/15 bg-gradient-to-br from-white/10 to-transparent p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                        <Hash className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xl font-semibold text-white">{topic.label}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs uppercase tracking-wide border-white/30 text-white/80",
                              !topic.is_active && "text-white/50"
                            )}
                          >
                            #{topic.slug}
                          </Badge>
                        </div>
                        <p className="text-white/60 text-sm">
                          {topic.description || "No description provided yet."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "border border-white/20 bg-transparent text-white/80",
                          topic.is_active ? "bg-white/10" : "bg-transparent text-white/50"
                        )}
                      >
                        {topic.is_active ? "Active" : "Archived"}
                      </Badge>
                      {topic.is_featured && (
                        <Badge className="bg-white/20 text-white border-white/40 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-white text-white" />
                          Featured
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-white/20 text-white/70">
                        {topic.usage_count} post{topic.usage_count === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="text-white border-white/30 hover:bg-white/20">
                          Manage
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-md border-white/20">
                        <DropdownMenuItem onClick={() => handleEdit(topic)}>
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleFeatured(topic)}>
                          {topic.is_featured ? "Remove featured tag" : "Mark as featured"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(topic)}>
                          {topic.is_active ? "Archive topic" : "Activate topic"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                      onClick={() => handleToggleActive(topic)}
                      title={topic.is_active ? "Archive topic" : "Activate topic"}
                    >
                      {topic.is_active ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

