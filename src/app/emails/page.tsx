"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Mail, Send, Inbox, Paperclip, CheckCircle2, Circle, Archive, Trash2, Loader2, RefreshCw } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import type { UserEmailMessage } from "@/types"

export default function EmailsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [messages, setMessages] = useState<UserEmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox")
  const [selectedMessage, setSelectedMessage] = useState<UserEmailMessage | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    html: "",
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      fetchUserEmail()
      fetchMessages()
    }
  }, [user])

  const fetchUserEmail = async () => {
    try {
      const response = await fetch("/api/emails/address")
      const data = await response.json()
      if (data.email) {
        setUserEmail(data.email)
        // Always call setup to ensure endpoint URL is up-to-date
        // This fixes cases where endpoints have wrong URLs (e.g., localhost in production)
        console.log("Email exists, ensuring endpoint URL is current...")
        setupEmail()
      } else {
        // If no email exists, set it up
        setupEmail()
      }
    } catch (error) {
      console.error("Error fetching email address:", error)
    }
  }

  const setupEmail = async () => {
    try {
      const response = await fetch("/api/emails/setup", {
        method: "POST",
      })
      const data = await response.json()
      if (data.email) {
        setUserEmail(data.email)
      }
      if (data.warning) {
        toast.warning(data.warning, {
          description: "You may need to verify the domain in Inbound first",
        })
      } else if (data.message && data.message.includes("updated")) {
        // Silently update - don't show toast for URL updates on every page load
        console.log("Endpoint URL updated successfully")
      } else if (data.message && data.message.includes("synced")) {
        toast.success("Email address synced with Inbound successfully")
      } else if (data.message && data.message.includes("created")) {
        toast.success("Email address created successfully")
      }
    } catch (error) {
      console.error("Error setting up email:", error)
      // Don't show error toast on every page load - only log it
      // toast.error("Failed to set up email address")
    }
  }

  const fetchMessages = async () => {
    try {
      setLoading(true)
      const type = activeTab === "inbox" ? "received" : "sent"
      const response = await fetch(`/api/emails/inbox?type=${type}`)
      const data = await response.json()
      const fetchedMessages = data.messages || []
      setMessages(fetchedMessages)
      
      // Update unread count for inbox
      if (type === "received") {
        const unread = fetchedMessages.filter((m: UserEmailMessage) => !m.is_read).length
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast.error("Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchMessages()
    }
  }, [activeTab, user])

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.html) {
      toast.error("Please fill in all fields")
      return
    }

    try {
      setSending(true)
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: composeData.to,
          subject: composeData.subject,
          html: composeData.html,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email")
      }

      toast.success("Email sent successfully!")
      setComposeOpen(false)
      setComposeData({ to: "", subject: "", html: "" })
      fetchMessages()
    } catch (error: any) {
      toast.error(error.message || "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const handleMarkRead = async (messageId: string, isRead: boolean, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }
    try {
      const response = await fetch("/api/emails/inbox", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId,
          isRead: !isRead,
        }),
      })

      if (response.ok) {
        fetchMessages()
        // Update the selected message if it's the one being marked
        if (selectedMessage && selectedMessage.id === messageId) {
          setSelectedMessage({ ...selectedMessage, is_read: !isRead })
        }
      }
    } catch (error) {
      console.error("Error updating message:", error)
    }
  }

  const handleMessageClick = (message: UserEmailMessage) => {
    setSelectedMessage(message)
    // Mark as read when opened
    if (!message.is_read) {
      handleMarkRead(message.id, message.is_read)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "Yesterday"
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (!user || isLoading) {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <Breadcrumb items={[]} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Email</h1>
              {userEmail && (
                <p className="text-white/60 text-sm mt-1">{userEmail}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchMessages}
              disabled={loading}
              variant="outline"
              className="border-white/20 text-white/80 hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white/10 text-white/80 hover:bg-white/20">
                  <Send className="h-4 w-4 mr-2" />
                  Compose
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white/10 border-0 backdrop-blur-md max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-white">Compose Email</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Send an email from {userEmail || "your email"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="to" className="text-white/80">To</Label>
                    <Input
                      id="to"
                      placeholder="recipient@example.com"
                      value={composeData.to}
                      onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-white/80">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="Email subject"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="html" className="text-white/80">Message</Label>
                    <Textarea
                      id="html"
                      placeholder="Your message..."
                      value={composeData.html}
                      onChange={(e) => setComposeData({ ...composeData, html: e.target.value })}
                      rows={10}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setComposeOpen(false)}
                      className="border-white/20 text-white/80 hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={sending}
                      className="bg-white/10 text-white/80 hover:bg-white/20"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!userEmail && (
          <Card className="bg-white/10 border-0 backdrop-blur-md">
            <CardContent className="p-6">
              <p className="text-white/80">Setting up your personalized email address...</p>
            </CardContent>
          </Card>
        )}

        {userEmail && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inbox" | "sent")}>
            <TabsList className="bg-white/10 border-0">
              <TabsTrigger value="inbox" className="data-[state=active]:bg-white/20 text-white/80">
                <Inbox className="h-4 w-4 mr-2" />
                Inbox
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20 text-white/80">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="data-[state=active]:bg-white/20 text-white/80">
                <Send className="h-4 w-4 mr-2" />
                Sent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="mt-4">
              <Card className="bg-white/10 border-0 backdrop-blur-md">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-white/80" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center">
                      <Mail className="h-12 w-12 mx-auto text-white/40 mb-4" />
                      <p className="text-white/60">No emails in your inbox</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${
                            !message.is_read ? "bg-white/5" : ""
                          }`}
                          onClick={() => handleMessageClick(message)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                onClick={(e) => handleMarkRead(message.id, message.is_read, e)}
                                className="mt-1 flex-shrink-0"
                              >
                                {message.is_read ? (
                                  <Circle className="h-4 w-4 text-white/40" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-white/80" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-white truncate">
                                    {message.from_name || message.from_email}
                                  </p>
                                  {!message.is_read && (
                                    <span className="h-2 w-2 rounded-full bg-white/80 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-white/80 text-sm truncate">{message.subject}</p>
                                <p className="text-white/60 text-xs mt-1">
                                  {formatDate(message.received_at || message.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sent" className="mt-4">
              <Card className="bg-white/10 border-0 backdrop-blur-md">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-white/80" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center">
                      <Send className="h-12 w-12 mx-auto text-white/40 mb-4" />
                      <p className="text-white/60">No sent emails</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => handleMessageClick(message)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white mb-1">To: {message.to_email}</p>
                              <p className="text-white/80 text-sm truncate">{message.subject}</p>
                              <p className="text-white/60 text-xs mt-1">
                                {formatDate(message.sent_at || message.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Message Detail Dialog */}
        {selectedMessage && (
          <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
            <DialogContent className="bg-white/10 border-0 backdrop-blur-md max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">{selectedMessage.subject}</DialogTitle>
                <DialogDescription className="text-white/70">
                  <div className="mt-2 space-y-1">
                    <p>
                      <span className="font-semibold">From:</span> {selectedMessage.from_name || selectedMessage.from_email}
                    </p>
                    <p>
                      <span className="font-semibold">To:</span> {selectedMessage.to_email}
                    </p>
                    <p>
                      <span className="font-semibold">Date:</span>{" "}
                      {new Date(selectedMessage.received_at || selectedMessage.sent_at || selectedMessage.created_at).toLocaleString()}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 border-t border-white/10 pt-4">
                {selectedMessage.html_content ? (
                  <div
                    className="prose prose-invert max-w-none text-white/80 prose-headings:text-white prose-p:text-white/80 prose-a:text-white/90 prose-strong:text-white"
                    style={{
                      // Override prose styles for better visibility
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}
                    dangerouslySetInnerHTML={{ __html: selectedMessage.html_content }}
                  />
                ) : (
                  <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{selectedMessage.text_content || '(No content)'}</p>
                )}
              </div>
              {selectedMessage.message_type === 'received' && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <Button
                    onClick={() => {
                      setComposeOpen(true)
                      setComposeData({
                        to: selectedMessage.from_email,
                        subject: `Re: ${selectedMessage.subject}`,
                        html: "",
                      })
                      setSelectedMessage(null)
                    }}
                    className="bg-white/10 text-white/80 hover:bg-white/20"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

