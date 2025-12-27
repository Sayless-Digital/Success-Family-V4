"use client"

import React, { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const EMAIL_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Sent to new users when they sign up",
    params: ["name"],
  },
  {
    id: "passwordReset",
    name: "Password Reset",
    description: "Sent when user requests password reset",
    params: ["resetLink"],
  },
  {
    id: "platformSubscriptionRequest",
    name: "Platform Subscription Request",
    description: "Sent when user submits payment to create a community",
    params: ["userName", "communityName", "amount", "billingCycle"],
  },
  {
    id: "platformPaymentVerified",
    name: "Platform Payment Verified",
    description: "Sent when platform payment is verified",
    params: ["userName", "communityName", "amount"],
  },
  {
    id: "platformPaymentRejected",
    name: "Platform Payment Rejected",
    description: "Sent when platform payment is rejected",
    params: ["userName", "communityName", "reason"],
  },
  {
    id: "platformInvoiceGenerated",
    name: "Platform Invoice Generated",
    description: "Sent when a new platform invoice is generated",
    params: ["userName", "communityName", "amount", "dueDate"],
  },
  {
    id: "platformPaymentReminder",
    name: "Platform Payment Reminder",
    description: "Sent as reminder for upcoming platform payment",
    params: ["userName", "communityName", "amount", "daysUntilDue", "dueDate"],
  },
  {
    id: "walletTopupReminder",
    name: "Wallet Top-Up Reminder",
    description: "Sent as reminder for mandatory wallet top-up",
    params: ["userName", "amount", "dueDate", "overdueDays"],
  },
  {
    id: "communitySubscriptionRequest",
    name: "Community Subscription Request",
    description: "Sent when user requests to join a community",
    params: ["userName", "communityName", "ownerName", "amount", "billingCycle"],
  },
  {
    id: "communityPaymentVerified",
    name: "Community Payment Verified",
    description: "Sent when community payment is verified",
    params: ["userName", "communityName", "ownerName"],
  },
  {
    id: "communityPaymentRejected",
    name: "Community Payment Rejected",
    description: "Sent when community payment is rejected",
    params: ["userName", "communityName", "reason"],
  },
  {
    id: "communityInvoiceGenerated",
    name: "Community Invoice Generated",
    description: "Sent when a new community invoice is generated",
    params: ["userName", "communityName", "amount", "dueDate"],
  },
  {
    id: "communityPaymentReminder",
    name: "Community Payment Reminder",
    description: "Sent as reminder for upcoming community payment",
    params: ["userName", "communityName", "amount", "daysUntilDue", "dueDate"],
  },
]

export default function AdminEmailsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [recipientEmail, setRecipientEmail] = useState<string>("")
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({})
  const [isSending, setIsSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Set current user email as default recipient
  useEffect(() => {
    if (user?.email && !recipientEmail) {
      setRecipientEmail(user.email)
    }
  }, [user?.email, recipientEmail])

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Initialize template params when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const template = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)
      if (template) {
        const params: Record<string, string> = {}
        template.params.forEach(param => {
          // Set default values based on param name
          switch (param) {
            case "name":
              params[param] = "Test User"
              break
            case "userName":
              params[param] = "Test User"
              break
            case "ownerName":
              params[param] = "Community Owner"
              break
            case "communityName":
              params[param] = "Test Community"
              break
            case "amount":
              params[param] = "99.99"
              break
            case "billingCycle":
              params[param] = "monthly"
              break
            case "resetLink":
              params[param] = "https://example.com/reset?token=test"
              break
            case "reason":
              params[param] = "Payment receipt unclear"
              break
            case "dueDate":
              params[param] = new Date().toISOString().split('T')[0]
              break
            case "daysUntilDue":
              params[param] = "3"
              break
            case "overdueDays":
              params[param] = "0"
              break
            default:
              params[param] = ""
          }
        })
        setTemplateParams(params)
      }
    }
  }, [selectedTemplate])

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !recipientEmail) {
      toast.error("Please select a template and enter a recipient email")
      return
    }

    setIsSending(true)
    setSendStatus(null)

    try {
      // Convert string params to appropriate types
      const params: Record<string, any> = { ...templateParams }
      
      // Convert numeric fields
      if (params.amount) params.amount = parseFloat(params.amount)
      if (params.daysUntilDue) params.daysUntilDue = parseInt(params.daysUntilDue)
      if (params.overdueDays) params.overdueDays = parseInt(params.overdueDays)

      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: selectedTemplate,
          recipientEmail,
          templateParams: params,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to send email")
      }

      setSendStatus({
        type: "success",
        message: data.message || "Test email sent successfully!",
      })
      toast.success("Test email sent successfully!")
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send test email"
      setSendStatus({
        type: "error",
        message: errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  // Don't render if not admin
  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  const selectedTemplateData = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate)

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <Breadcrumb items={[]} />
        
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
            <Mail className="h-5 w-5 text-white/80" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Email Testing</h1>
            <p className="text-white/60 text-sm mt-1">Test email templates and verify email delivery</p>
          </div>
        </div>

        {/* Current User Email Display */}
        {user?.email && (
          <Card className="bg-white/10 border-0 backdrop-blur-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Your Email Address</p>
                    <p className="text-white font-medium">{user.email}</p>
                  </div>
                </div>
                <Button
                  onClick={() => user.email && setRecipientEmail(user.email)}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Use as Recipient
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/10 border-0 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Send Test Email</CardTitle>
            <CardDescription className="text-white/70">
              Select an email template and send a test email to verify it works correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template" className="text-white/80">Email Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template" className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select an email template" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateData && (
                <p className="text-white/60 text-xs mt-1">{selectedTemplateData.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient" className="text-white/80">Recipient Email</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="test@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            {selectedTemplateData && selectedTemplateData.params.length > 0 && (
              <div className="space-y-4">
                <Label className="text-white/80">Template Parameters</Label>
                <div className="space-y-3">
                  {selectedTemplateData.params.map(param => (
                    <div key={param} className="space-y-2">
                      <Label htmlFor={param} className="text-white/70 text-sm capitalize">
                        {param.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Input
                        id={param}
                        type={param === "dueDate" ? "date" : param.includes("amount") || param.includes("Days") ? "number" : "text"}
                        value={templateParams[param] || ""}
                        onChange={(e) =>
                          setTemplateParams({ ...templateParams, [param]: e.target.value })
                        }
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        placeholder={`Enter ${param}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sendStatus && (
              <div
                className={`p-4 rounded-lg border ${
                  sendStatus.type === "success"
                    ? "bg-green-500/20 border-green-500/50"
                    : "bg-red-500/20 border-red-500/50"
                } flex items-start gap-3`}
              >
                {sendStatus.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-white text-sm">{sendStatus.message}</p>
              </div>
            )}

            <Button
              onClick={handleSendTestEmail}
              disabled={isSending || !selectedTemplate || !recipientEmail}
              className="bg-white/10 text-white/80 hover:bg-white/20 w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-0 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Available Templates</CardTitle>
            <CardDescription className="text-white/70">
              List of all available email templates in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {EMAIL_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                  <p className="text-white/60 text-sm mb-2">{template.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {template.params.map(param => (
                      <span
                        key={param}
                        className="px-2 py-1 text-xs rounded bg-white/10 text-white/70"
                      >
                        {param}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

