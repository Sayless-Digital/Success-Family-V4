"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  HelpCircle,
  Wallet,
  MessageSquare,
  Video,
  Zap,
  CreditCard,
  Building2,
  User,
  Share2,
  HardDrive,
} from "lucide-react"

const faqSections = [
  {
    title: "Getting Started",
    icon: HelpCircle,
    items: [
      {
        question: "What is Success Family Platform?",
        answer:
          "Success Family Platform is a community platform where creators and members can connect, share content, and grow together. You can create or join communities, post content, interact with others, and even earn points from your engagement.",
      },
      {
        question: "How do I get started?",
        answer:
          "To get started, sign up for an account using your email address. After signing up, you'll need to top up your wallet to get points, which are used for everything on the platform. Once you have points, you can explore communities, create your own community, boost posts you love, join live events, and more. All communities are free to join!",
      },
      {
        question: "Is the platform free to use?",
        answer:
          "Yes! Signing up and joining communities is completely free. However, the platform uses a points-based system, so you'll need to top up your wallet to get points. Points are used for boosting posts, starting live events, purchasing additional storage, and other features. You can also earn points when other users boost your posts!",
      },
      {
        question: "Do I need to top up after signing up?",
        answer:
          "Yes! After signing up, you'll need to top up your wallet to get points. Points are required for most activities on the platform, such as boosting posts, joining live events, and purchasing additional storage. You can top up your wallet from the Wallet page by submitting a payment receipt.",
      },
    ],
  },
  {
    title: "Communities",
    icon: Building2,
    items: [
      {
        question: "What are communities?",
        answer:
          "Communities are spaces where like-minded individuals can connect, share content, and engage with each other. Each community has its own feed, members, events, and settings. All communities are completely free to join!",
      },
      {
        question: "How do I create a community?",
        answer:
          "To create a community, click the 'Create Community' button in the navigation. You'll need to provide a name and description. Once created, you'll be the owner and can manage all aspects of your community. Creating a community is free, but you'll need points to start live events.",
      },
      {
        question: "How do I join a community?",
        answer:
          "You can browse all available communities from the Communities page. All communities are free to join - simply click the 'Join' button on any community page. You can leave a community at any time.",
      },
      {
        question: "Can I leave a community?",
        answer:
          "Yes, you can leave a community at any time. Since all communities are free, there are no subscription fees or refunds to worry about. You can rejoin the same community later if you change your mind.",
      },
      {
        question: "Are there any costs to join communities?",
        answer:
          "No! All communities are completely free to join. However, while joining is free, you'll need points to participate in certain activities like boosting posts, joining live events, or adding media to posts. These activities use the points you've topped up in your wallet.",
      },
    ],
  },
  {
    title: "Points & Wallets",
    icon: Wallet,
    items: [
      {
        question: "What are points?",
        answer:
          "Points are the virtual currency used for everything on the platform. Points are required to boost posts, start live events, join events, purchase additional storage, and other features. The platform operates entirely on a points-based system - everything you do requires points from your wallet. Your wallet has two types of points: regular wallet balance (points you've purchased) and earnings balance (points you've earned from boosts, which can be cashed out). You can spend from either balance when boosting posts or joining events.",
      },
      {
        question: "How do I get points?",
        answer:
          "You get points by topping up your wallet. After signing up, you'll need to top up your wallet to get points. Go to your Wallet page, enter the amount you want to add (in TTD), and upload a payment receipt. Once verified by an admin, points will be added to your wallet. You can also earn points when other users boost your posts. See the 'Payments & Top-ups' section for detailed top-up instructions.",
      },
      {
        question: "How do I convert points to cash?",
        answer:
          "When you earn points from other users boosting your posts, those points go into your earnings balance (separate from your regular wallet balance). Note: Points from event registrations go to the event owner's regular wallet balance, not earnings balance, so they cannot be cashed out. Once you reach the minimum payout threshold in your earnings balance, you can request a payout. The platform will process your payout and transfer the funds to your bank account. You can only cash out earnings, not the points you've purchased (regular wallet balance).",
      },
      {
        question: "What is the minimum payout amount?",
        answer:
          "The minimum payout amount may be subject to change and can be viewed in your Wallet page. You need to accumulate at least this amount in earnings before you can request a payout. Check your Wallet page for the current minimum payout threshold.",
      },
      {
        question: "How are points calculated?",
        answer:
          "Points are calculated based on the buy price per point, which may be subject to change. When you top up, the amount you pay (minus platform fees) is divided by the current buy price per point to determine how many points you receive. The buy price per point is shown on your Wallet page when you top up. Your existing points remain valid even if the buy price changes.",
      },
    ],
  },
  {
    title: "Boosts & Posts",
    icon: Zap,
    items: [
      {
        question: "What are boosts?",
        answer:
          "Boosts are a way to show appreciation for posts you love and help them get more visibility. When you boost a post, you spend 1 point from your combined balance (regular wallet balance and earnings balance), and the author earns 1 point in their earnings balance (separate from wallet balance, which can be cashed out later). Additionally, creators can offer extra rewards for boosting their posts, such as exclusive automated messages sent directly to your inbox. This helps great content get discovered while rewarding both you and the creator.",
      },
      {
        question: "How do I boost a post?",
        answer:
          "To boost a post, simply click the boost button (lightning icon) on any post you like. You'll spend 1 point from your combined balance (regular wallet balance and earnings balance), and the post author will receive 1 point in their earnings balance (separate from wallet balance, which can be cashed out later). If the creator has set up a boost reward (like an exclusive message), you'll receive it automatically via direct message. You can boost multiple posts, but you can only boost each post once. Important: Boosts are permanent and cannot be reversed, so make sure you want to boost a post before clicking.",
      },
      {
        question: "Can I undo a boost?",
        answer:
          "No, boosts are permanent and cannot be reversed. Once you boost a post, the point is spent and transferred to the post author's earnings balance. You cannot undo a boost after clicking the boost button, so make sure you want to boost a post before clicking.",
      },
      {
        question: "What are boost rewards?",
        answer:
          "Boost rewards are extra benefits that creators can offer to users who boost their posts. For example, creators can set up an automated message that gets sent directly to your inbox when you boost their post. This could include exclusive content, special offers, or personalized thank-you messages. Not all posts have boost rewards - it's up to each creator to decide if they want to offer them.",
      },
      {
        question: "How do I create a post?",
        answer:
          "To create a post, navigate to a community you're a member of and click the 'Create Post' button. You can add text, images, and voice notes to your post. Once published, other members can view, comment, and boost your post.",
      },
      {
        question: "What types of media can I add to posts?",
        answer:
          "Currently, you can add images and voice notes to your posts. Additional media types such as videos and documents are coming soon. Media files are stored securely in the cloud and may have file size limits.",
      },
      {
        question: "How does the discovery feed work?",
        answer:
          "The discovery feed shows posts from all active communities on the platform. Posts are ranked by a discovery score that considers recent boosts, total boosts, and recency. When you boost a post with points, it helps that post get more visibility and rise to the top. This helps the best content get discovered while rewarding creators with points.",
      },
    ],
  },
  {
    title: "Events & Live Streaming",
    icon: Video,
    items: [
      {
        question: "What are events?",
        answer:
          "Events are live streaming sessions that community owners can host. Members can register to join live events and participate in video calls with other attendees. Events are a great way to connect with your community in real-time. Both starting and joining events require points from your wallet.",
      },
      {
        question: "How do I create a live event?",
        answer:
          "Community owners can create events from the Events page in their community. You'll need to provide a description and schedule the event time. Starting an event costs points from your wallet - the exact cost may be subject to change and can be viewed when creating an event. Once the event starts, registered members can join the live stream.",
      },
      {
        question: "How much does it cost to start an event?",
        answer:
          "Starting an event costs points from your wallet. The exact cost may be subject to change and can be viewed when creating an event on the Events page. This points fee goes to the platform and helps cover the infrastructure costs of live streaming. You'll need sufficient points in your wallet to start an event.",
      },
      {
        question: "How much does it cost to join an event?",
        answer:
          "Joining an event also costs points from your wallet. The exact cost may be subject to change and is shown when you register for an event. This points fee goes to the event owner's regular wallet balance (not earnings balance). If you cancel your registration before the event starts, you'll receive a full refund. You'll need sufficient points in your wallet to join an event.",
      },
      {
        question: "Can I record events?",
        answer:
          "Yes! Event owners can record their live streams. Recordings are automatically saved and can be accessed later. You can also add recordings to playlists or create posts with them for your community to watch anytime.",
      },
      {
        question: "What happens if an event is cancelled?",
        answer:
          "If an event is cancelled by the owner, the event owner receives a full refund of the event creation cost, and all registered users receive full refunds of their registration fees. Refunds are automatically processed and points are returned to your wallet balance. You'll be notified if an event you've registered for is cancelled.",
      },
      {
        question: "Can I cancel my event registration?",
        answer:
          "Yes, you can cancel your event registration before the event starts and receive a full refund. The points will be returned to your wallet balance. Once the event has started or ended, you cannot cancel your registration.",
      },
      {
        question: "What happens if I miss a live event?",
        answer:
          "If an event was recorded, you can watch the recording later. Recordings are typically available in the community's Events page or in playlists that include the recording. However, you won't be able to participate in the live discussion.",
      },
    ],
  },
  {
    title: "Storage & Media",
    icon: HardDrive,
    items: [
      {
        question: "How much storage do I get?",
        answer:
          "Every user gets 1 GB of free storage for their media files and event recordings. This is enough for most users' needs. If you need more storage, you can purchase additional storage using points.",
      },
      {
        question: "How do I purchase additional storage?",
        answer:
          "You can purchase additional storage from the Storage page using points from your wallet. Storage can be purchased as a one-time purchase (per GB). Additionally, storage over the 1 GB free tier incurs a monthly recurring charge (in points) on the 1st of each month. The exact pricing in points may be subject to change and is shown on the Storage page. You'll need sufficient points in your wallet to purchase additional storage.",
      },
      {
        question: "What happens if I exceed my storage limit?",
        answer:
          "If you exceed your storage limit, you'll need to either purchase additional storage using points or delete old media. The platform will notify you when you're approaching your limit so you can take action before it becomes an issue. Make sure you have enough points in your wallet to purchase additional storage if needed.",
      },
      {
        question: "Can I upload videos to posts?",
        answer:
          "Video uploads to posts are coming soon. Currently, you can add images and voice notes to posts. However, event recordings (which are videos) are automatically saved when you record live events, and these can be added to playlists or shared in your community.",
      },
      {
        question: "What are playlists?",
        answer:
          "Playlists are collections of videos that you can organize for your community. You can create playlists with event recordings, and members can watch them in order. Playlists are great for organizing educational content or event series. Video uploads to playlists are coming soon.",
      },
    ],
  },
  {
    title: "Direct Messages",
    icon: MessageSquare,
    items: [
      {
        question: "How do I send a direct message?",
        answer:
          "To send a direct message, go to the Messages page and click 'New Message'. You can search for users by username and start a conversation. You can message any user directly - there are no message requests required. Conversations start automatically when you send your first message.",
      },
      {
        question: "Can I send media in direct messages?",
        answer:
          "Yes! You can send images and voice notes in direct messages. Media files are stored securely and count toward your storage limit if they're large files.",
      },
    ],
  },
  {
    title: "Profile & Social",
    icon: User,
    items: [
      {
        question: "How do I edit my profile?",
        answer:
          "You can edit your profile from the Account page. You can update your username, name, bio, and profile picture. Your username must be unique and can only contain letters, numbers, and underscores.",
      },
      {
        question: "What is my profile used for?",
        answer:
          "Your profile is your public presence on the platform. Other users can view your profile to see your posts, communities, followers, and following. Your profile picture and bio help others get to know you.",
      },
      {
        question: "Can I follow other users?",
        answer:
          "Yes! You can follow other users to see their activity and stay connected. Following someone doesn't automatically give them access to your content, but it helps you discover their posts and updates.",
      },
    ],
  },
  {
    title: "Referrals",
    icon: Share2,
    items: [
      {
        question: "How do referrals work?",
        answer:
          "When you refer someone to the platform, you get a unique referral code. When someone signs up using your code and then tops up their wallet, you receive bonus points. You earn bonus points for each of the first few top-ups from each referred user (the exact number of top-ups may be subject to change). This is a great way to grow the platform while earning rewards for bringing new users to the platform.",
      },
      {
        question: "How do I get my referral code?",
        answer:
          "Your referral code is available on the Referrals page. You can share this code with friends, family, or on social media. When someone signs up using your code and completes their first top-up, you'll receive bonus points. You'll continue to earn bonus points for their subsequent top-ups up to the maximum limit (typically the first 3 top-ups per referred user).",
      },
      {
        question: "What do I get for referring someone?",
        answer:
          "When someone signs up using your referral code and tops up their wallet, you receive bonus points. You earn bonus points for each of the first few top-ups from each referred user (typically the first 3 top-ups). After the maximum number of top-ups is reached for a referred user, you won't earn additional bonus points from their future top-ups. The exact amount of bonus points and the maximum number of top-ups that generate bonuses per referred user may be subject to change. You can view the current referral bonus amount and limits on your Referrals page.",
      },
      {
        question: "How do I use someone's referral code?",
        answer:
          "When signing up, you can enter a referral code during the registration process. If you have a referral link, the code will be automatically applied when you click the link and sign up. Note: Using a referral code helps the person who referred you earn bonus points when you top up your wallet, but you don't receive any bonus points for using a referral code.",
      },
    ],
  },
  {
    title: "Payments & Top-ups",
    icon: CreditCard,
    items: [
      {
        question: "How do I top up my wallet?",
        answer:
          "To top up your wallet, go to your Wallet page and click 'Top Up'. You'll need to enter the amount you want to add (in TTD) and upload a payment receipt from a bank transfer. Once your payment is verified by an admin (typically within 1-2 business days), the points will be added to your wallet based on the current buy price per point.",
      },
      {
        question: "How long does payment verification take?",
        answer:
          "Payment verification is typically done within 1-2 business days by platform administrators. Once your payment is verified, the points will be added to your wallet and you can start using them immediately. You'll receive a notification when your top-up is verified.",
      },
      {
        question: "What payment methods are accepted?",
        answer:
          "Currently, the platform accepts bank transfers (TTD) for wallet top-ups. You can view the bank account details on the Wallet page when you click 'Top Up'. Make sure to upload a clear receipt showing the transfer so your payment can be verified quickly.",
      },
      {
        question: "Can I get a refund for top-ups?",
        answer:
          "Top-ups are typically non-refundable once verified. However, if you have questions or issues with a top-up, contact support. Keep in mind that points are used immediately when you boost posts or join events, so these actions cannot be reversed.",
      },
      {
        question: "How do I view my transaction history?",
        answer:
          "You can view your transaction history in your Wallet page. This includes all top-ups, payouts, point spends (like boosting posts or joining events), and earnings (from others boosting your posts). Each transaction shows the date, amount, type, and status.",
      },
      {
        question: "What happens if my top-up is rejected?",
        answer:
          "If your top-up is rejected, you'll be notified and no points will be added to your wallet. Common reasons for rejection include unclear receipts, incorrect amounts, or payment issues. You can submit a new top-up with a corrected receipt if needed.",
      },
    ],
  },
]

export default function FAQView() {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 max-w-4xl mx-auto space-y-8 py-8">
        <PageHeader
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about the Success Family Platform"
          className="text-center"
        />

        <div className="space-y-6">
          {faqSections.map((section) => {
            const Icon = section.icon
            return (
              <Card
                key={section.title}
                className="bg-white/10 backdrop-blur-md border-0"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-white/80" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">
                      {section.title}
                    </h2>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {section.items.map((item, index) => (
                      <AccordionItem
                        key={index}
                        value={`item-${section.title}-${index}`}
                        className="border-white/20"
                      >
                        <AccordionTrigger className="text-white hover:text-white/80 text-left">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-white/70 leading-relaxed">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-0">
          <CardContent className="p-6 text-center space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Still have questions?
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              If you can't find the answer you're looking for, feel free to
              reach out to our support team or ask in one of our communities.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

