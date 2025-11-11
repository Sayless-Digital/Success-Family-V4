"use client"

import Link from "next/link"
import { 
  Users, 
  Zap, 
  TrendingUp, 
  MessageSquare, 
  Video, 
  Wallet, 
  Building2, 
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

export default function LearnMoreView() {
  const features = [
    {
      icon: Building2,
      title: "Communities",
      description: "Join or create exclusive communities focused on success, growth, and achievement. Connect with like-minded individuals who share your goals.",
    },
    {
      icon: Sparkles,
      title: "Boost System",
      description: "Support content you love by boosting posts. Help creators gain visibility while building your reputation in the community.",
    },
    {
      icon: Wallet,
      title: "Earn & Grow",
      description: "Monetize your content through the boost system. Earn points that convert to real payouts as you build your audience.",
    },
    {
      icon: MessageSquare,
      title: "Engage & Connect",
      description: "Share posts, media, and insights. Build meaningful connections through comments, messages, and community interactions.",
    },
    {
      icon: Video,
      title: "Live Events",
      description: "Host and join live video events. Stream content, host discussions, and interact with your community in real-time.",
    },
    {
      icon: TrendingUp,
      title: "Discovery Feed",
      description: "Discover trending content across all communities. Find inspiration, learn from others, and stay connected with what matters.",
    }
  ]

  const benefits = [
    "Monetize your content and expertise",
    "Build a loyal community around your interests",
    "Discover and learn from successful creators",
    "Connect with like-minded individuals",
    "Access exclusive community content",
    "Track your growth and earnings in real-time"
  ]

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-12 sm:space-y-16">
        {/* Hero Section */}
        <div className="space-y-6 text-center">
          <PageHeader
            title="Success Family Platform"
            subtitle="A community-driven platform where creators connect, grow, and succeed together"
            className="text-center"
          />
          <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Join a thriving ecosystem of success-driven individuals. Share your journey, 
            support others, and build lasting connections while earning from your content.
          </p>
        </div>

        {/* Key Features Grid */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-3">
              <Zap className="h-6 w-6 text-white/70" />
              Platform Features
            </h2>
            <p className="text-white/70 text-sm sm:text-base">
              Everything you need to build, grow, and monetize your community
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card 
                  key={index}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0 hover:from-white/15 hover:to-white/10 transition-all duration-300 group"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className={cn(
                      "w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center",
                      "group-hover:scale-110 group-hover:bg-white/15 transition-all duration-300"
                    )}>
                      <Icon className="h-6 w-6 text-white/80" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">
                        {feature.title}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Benefits Section */}
        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0">
          <CardContent className="p-8 sm:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-white/70" />
                  Why Join Success Family?
                </h2>
                <p className="text-white/70 text-sm sm:text-base">
                  Start your journey toward success today
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <CheckCircle2 className="h-5 w-5 text-white/70 flex-shrink-0 mt-0.5" />
                    <p className="text-white/80 text-sm sm:text-base">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works Section */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-3">
              <Globe className="h-6 w-6 text-white/70" />
              How It Works
            </h2>
            <p className="text-white/70 text-sm sm:text-base">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Create Your Profile",
                description: "Sign up and build your profile. Share your story, expertise, and goals with the community.",
                icon: Users
              },
              {
                step: "2",
                title: "Join Communities",
                description: "Explore and join communities that align with your interests. Or create your own community.",
                icon: Building2
              },
              {
                step: "3",
                title: "Share & Earn",
                description: "Post content, engage with others, and boost content you love. Earn points and grow your influence.",
                icon: TrendingUp
              }
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <Card 
                  key={index}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0 text-center"
                >
                  <CardContent className="p-8 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{item.step}</span>
                    </div>
                    <div className="w-12 h-12 mx-auto rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white/80" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border-0">
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <Sparkles className="h-12 w-12 text-white/70 mx-auto" />
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Ready to Get Started?
              </h2>
              <p className="text-lg text-white/80 leading-relaxed">
                Join thousands of creators who are already building their success on the platform. 
                Start your journey today and connect with a community that supports your growth.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  size="lg" 
                  asChild
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Link href="/communities">
                    Explore Communities
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  asChild
                >
                  <Link href="/">
                    Go to Home
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

