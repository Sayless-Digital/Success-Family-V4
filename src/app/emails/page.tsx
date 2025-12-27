"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Mail, Send, Inbox, CheckCircle2, Circle, Loader2, RefreshCw, Search, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "sonner"
import type { UserEmailMessage } from "@/types"

// Function to clean email HTML and remove embedded headers
function cleanEmailHtml(html: string): string {
  if (!html || typeof document === 'undefined') return html
  
  try {
    // Create a temporary DOM element to parse and manipulate the HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove elements that commonly contain email headers
    const headerSelectors = [
      '.email-header',
      '.message-header',
      '.email-subject',
      '.mail-header',
      '.msg-header',
      '.email-metadata',
      '.message-metadata',
    ]
    
    headerSelectors.forEach(selector => {
      try {
        tempDiv.querySelectorAll(selector).forEach(el => el.remove())
      } catch (e) {
        // Ignore selector errors
      }
    })
    
    // Remove Gmail and Outlook specific classes
    tempDiv.querySelectorAll('[class*="gmail_"], [class*="Outlook"]').forEach(el => el.remove())
    
    // Remove elements with border-left that contain header-like text patterns
    // This catches quoted email headers that show "From:", "To:", "Subject:" with borders
    tempDiv.querySelectorAll('div[style*="border-left"], blockquote[style*="border-left"], p[style*="border-left"]').forEach(el => {
      const text = (el.textContent || '').trim()
      // Check if it contains email header patterns (From:, To:, Subject:, Date:)
      const hasFrom = /From:\s*.+@/i.test(text)
      const hasTo = /To:\s*.+@/i.test(text)
      const hasSubject = /Subject:\s*.+/i.test(text)
      const hasDate = /Date:\s*.+/i.test(text)
      
      // If it has multiple header fields, it's likely an embedded email header
      const headerFieldCount = [hasFrom, hasTo, hasSubject, hasDate].filter(Boolean).length
      if (headerFieldCount >= 2) {
        el.remove()
      }
    })
    
    // Remove style and head tags
    tempDiv.querySelectorAll('style, head').forEach(el => el.remove())
    
    return tempDiv.innerHTML
  } catch (error) {
    console.error('Error cleaning email HTML:', error)
    return html // Return original HTML if cleaning fails
  }
}

export default function EmailsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [messages, setMessages] = useState<UserEmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox")
  const [selectedMessage, setSelectedMessage] = useState<UserEmailMessage | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "email" | "compose">("list")
  const [isClient, setIsClient] = useState(false)
  
  const [composeData, setComposeData] = useState({
    to: "",
    subject: "",
    html: "",
  })

  useEffect(() => {
    setIsClient(true)
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

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
      } else {
        // If no email exists, create it automatically
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
      } else if (data.message && data.message.includes("created")) {
        toast.success("Email address created successfully")
      }
    } catch (error) {
      console.error("Error setting up email:", error)
      toast.error("Failed to set up email address")
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
      setIsComposing(false)
      setComposeData({ to: "", subject: "", html: "" })
      if (isMobile) {
        setMobileView("list")
      }
      // Switch to sent tab and refresh messages
      setActiveTab("sent")
      fetchMessages()
    } catch (error: any) {
      toast.error(error.message || "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const handleStartCompose = () => {
    setIsComposing(true)
    setSelectedMessage(null)
    if (isMobile) {
      setMobileView("compose")
    }
  }

  const handleCancelCompose = () => {
    setIsComposing(false)
    setComposeData({ to: "", subject: "", html: "" })
    if (isMobile) {
      setMobileView("list")
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
    if (isMobile) {
      setMobileView("email")
    }
    // Mark as read when opened
    if (!message.is_read) {
      handleMarkRead(message.id, message.is_read)
    }
  }

  const handleBackToList = () => {
    setMobileView("list")
    setSelectedMessage(null)
    setIsComposing(false)
  }

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages
    const query = searchTerm.toLowerCase()
    return messages.filter((msg) => {
      const from = (msg.from_name || msg.from_email || "").toLowerCase()
      const to = (msg.to_email || "").toLowerCase()
      const subject = (msg.subject || "").toLowerCase()
      const content = (msg.text_content || "").toLowerCase()
      return from.includes(query) || to.includes(query) || subject.includes(query) || content.includes(query)
    })
  }, [messages, searchTerm])

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    return formatRelativeTime(dateString)
  }

  if (!user || isLoading) {
    return null
  }

  if (!userEmail) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 max-w-md mx-4">
            <CardContent className="p-8 text-center">
              <Mail className="h-16 w-16 text-white/60 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Setting up your email</h2>
              <p className="text-white/80 mb-6">
                Your personalized email address is being configured. This may take a moment.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem-3rem)] lg:h-[calc(100dvh-5rem)] w-full">
      <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
        {/* Left Sidebar - Email List */}
        <div className={cn(
          "w-full lg:w-[360px] xl:w-[400px] lg:flex-none flex flex-col h-full",
          !isClient && "lg:flex hidden",
          isClient && isMobile && (mobileView === "email" || mobileView === "compose") && "hidden"
        )}>
          <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full overflow-hidden">
            {/* Current User Email Display */}
            <div className="p-3 border-b border-white/15">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-3.5 w-3.5 text-white/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white/60 text-[10px] uppercase tracking-wide">Your Email</p>
                    <p className="text-white font-medium text-xs truncate">{userEmail}</p>
                  </div>
                </div>
                <Button
                  onClick={handleStartCompose}
                  size="sm"
                  className="bg-white/10 text-white/80 hover:bg-white/20 flex-shrink-0 h-7 px-2 text-xs"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Compose
                </Button>
              </div>
            </div>

            {/* Header with Actions */}
            <div className="p-3.5 border-b border-white/15">
              {/* Search, Dropdown, and Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search emails"
                    className="bg-white/10 border-white/15 text-white pl-9 h-9 text-sm placeholder:text-white/40"
                  />
                </div>
                <Select value={activeTab} onValueChange={(v) => {
                  setActiveTab(v as "inbox" | "sent")
                  setSelectedMessage(null)
                  setIsComposing(false)
                  if (isMobile) {
                    setMobileView("list")
                  }
                }}>
                  <SelectTrigger className="w-[120px] bg-white/10 border-white/20 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbox">
                      <div className="flex items-center gap-2">
                        <Inbox className="h-4 w-4" />
                        <span>Inbox</span>
                        {unreadCount > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                    <SelectItem value="sent">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        <span>Sent</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchMessages}
                  disabled={loading}
                  variant="ghost"
                  size="icon"
                  className="rounded-full bg-white/10 text-white/80 hover:bg-white/15 h-9 w-9 flex-shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Email List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
                {loading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-white/80" />
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="px-3 py-6 text-center text-white/50 text-sm">
                    {searchTerm ? "No emails found" : activeTab === "inbox" ? "No emails in your inbox" : "No sent emails"}
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const selected = selectedMessage?.id === message.id
                    const isUnread = !message.is_read && activeTab === "inbox"
                    
                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => handleMessageClick(message)}
                        className={cn(
                          "w-full rounded-lg border transition-all text-left cursor-pointer",
                          // Base background styles - always have a background
                          "bg-white/5 border-white/10",
                          // Hover state
                          "hover:bg-white/10 hover:border-white/20",
                          // Selected state
                          selected && "bg-white/15 border-white/30 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]",
                          // Unread state - more prominent background
                          isUnread && !selected && "bg-white/8 border-white/15",
                          isUnread && selected && "bg-white/20 border-white/35",
                        )}
                      >
                        <div className="px-3 py-2.5 flex items-start gap-2.5">
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkRead(message.id, message.is_read, e)
                            }}
                            className="mt-0.5 flex-shrink-0 cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                handleMarkRead(message.id, message.is_read, e as any)
                              }
                            }}
                          >
                            {message.is_read ? (
                              <Circle className="h-4 w-4 text-white/40" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-white/80" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white/80 font-medium truncate text-sm">
                                {activeTab === "inbox" 
                                  ? (message.from_name || message.from_email)
                                  : `To: ${message.to_email}`
                                }
                              </p>
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)] flex-shrink-0" />
                              )}
                            </div>
                            <p className={cn("text-xs truncate leading-snug", isUnread ? "text-white font-medium" : "text-white/70")}>
                              {message.subject || "(No subject)"}
                            </p>
                            <p className="text-[11px] text-white/50 mt-1" suppressHydrationWarning>
                              {formatDate(
                                activeTab === "inbox" 
                                  ? (message.received_at || message.created_at)
                                  : (message.sent_at || message.created_at)
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
            </div>
          </div>
        </div>

        {/* Right Panel - Email Preview or Compose */}
        <div className={cn(
          "flex flex-col h-full overflow-hidden lg:flex-1",
          // Desktop: Always show right panel
          !isClient && "hidden lg:flex",
          // Mobile: Show only when viewing email or composing
          isClient && isMobile && mobileView === "list" && "hidden",
          isClient && isMobile && (mobileView === "email" || mobileView === "compose") && "flex",
          // Desktop: Always visible
          !isMobile && "flex"
        )}>
          <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full">
            {isComposing ? (
              <>
                {/* Compose Header */}
                <div className="p-3.5 border-b border-white/15 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="rounded-full text-white/70 hover:text-white/90 hover:bg-white/10 shrink-0 h-9 w-9"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-white/90 font-semibold text-base">
                        Compose Email
                      </h2>
                      <p className="text-xs text-white/50 mt-0.5">
                        From: {userEmail || "your email"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compose Form */}
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-4 sm:p-5 space-y-3 flex-shrink-0">
                    <Input
                      id="compose-to"
                      placeholder="To: recipient@example.com"
                      value={composeData.to}
                      onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-10 text-sm"
                    />
                    <Input
                      id="compose-subject"
                      placeholder="Subject: Email subject"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-10 text-sm"
                    />
                  </div>
                  <div className="flex-1 px-4 sm:px-5 pb-4 sm:pb-5 min-h-0">
                    <Textarea
                      id="compose-message"
                      placeholder="Your message..."
                      value={composeData.html}
                      onChange={(e) => setComposeData({ ...composeData, html: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none text-sm h-full"
                    />
                  </div>
                </div>

                {/* Compose Actions */}
                <Separator className="bg-white/10" />
                <div className="p-3.5 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelCompose}
                    className="border-white/20 text-white/80 hover:bg-white/10 h-9 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || !composeData.to || !composeData.subject || !composeData.html}
                    className="bg-white/10 text-white/80 hover:bg-white/20 h-9 text-sm"
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
              </>
            ) : selectedMessage ? (
              <>
                {/* Email Header */}
                <div className="border-b border-white/15 flex flex-col">
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleBackToList}
                          className="rounded-full text-white/70 hover:text-white/90 hover:bg-white/10 shrink-0 h-9 w-9 mt-0.5"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="min-w-0 flex-1">
                        <h1 className="text-white/90 font-semibold text-lg mb-3 break-words">
                          {selectedMessage.subject || "(No subject)"}
                        </h1>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/50 font-medium min-w-[50px]">From:</span>
                            <span className="text-white/80 truncate">
                              {selectedMessage.from_name ? (
                                <>
                                  <span className="font-medium">{selectedMessage.from_name}</span>
                                  <span className="text-white/50 ml-1">&lt;{selectedMessage.from_email}&gt;</span>
                                </>
                              ) : (
                                selectedMessage.from_email
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/50 font-medium min-w-[50px]">To:</span>
                            <span className="text-white/80 truncate">{selectedMessage.to_email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/50 font-medium min-w-[50px]">Date:</span>
                            <span className="text-white/80" suppressHydrationWarning>
                              {new Date(
                                activeTab === "inbox" 
                                  ? (selectedMessage.received_at || selectedMessage.created_at)
                                  : (selectedMessage.sent_at || selectedMessage.created_at)
                              ).toLocaleString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedMessage.message_type === 'received' && (
                      <div className="flex-shrink-0">
                        <Button
                          onClick={() => {
                            setComposeData({
                              to: selectedMessage.from_email,
                              subject: `Re: ${selectedMessage.subject}`,
                              html: "",
                            })
                            setIsComposing(true)
                            setSelectedMessage(null)
                            if (isMobile) {
                              setMobileView("compose")
                            }
                          }}
                          className="bg-white/10 text-white/80 hover:bg-white/20 h-9 text-sm"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Body */}
                <ScrollArea className="flex-1">
                  <div className="p-6 sm:p-8">
                    <div className="prose prose-invert prose-lg max-w-none 
                      prose-headings:text-white prose-headings:font-semibold
                      prose-p:text-white/90 prose-p:leading-relaxed prose-p:my-4
                      prose-a:text-white/90 prose-a:underline prose-a:decoration-white/40
                      prose-strong:text-white prose-strong:font-semibold
                      prose-ul:text-white/90 prose-ol:text-white/90
                      prose-li:text-white/90
                      prose-blockquote:text-white/70 prose-blockquote:border-white/20
                      prose-code:text-white/90 prose-pre:text-white/90
                      prose-img:rounded-lg prose-img:my-4">
                      {selectedMessage.html_content ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: cleanEmailHtml(selectedMessage.html_content) }}
                          className="email-content"
                          style={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            lineHeight: '1.6',
                          }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-white/90 leading-relaxed text-base">
                          {selectedMessage.text_content || '(No content)'}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-4">
                <div className="h-14 w-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/70">
                  <Mail className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-white/90 text-lg font-semibold">Select an email</h3>
                  <p className="text-white/50 text-sm max-w-sm mx-auto">
                    Choose an email from the list to view its contents, or click Compose to send a new email.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

