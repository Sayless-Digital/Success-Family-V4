import type { HolidayMode } from "./holiday"

// Social media links
export interface UserSocials {
  twitter?: string
  linkedin?: string
  github?: string
  instagram?: string
  facebook?: string
  youtube?: string
  tiktok?: string
  website?: string
}

// User role types
export type UserRole = 'admin' | 'community_owner' | 'user'

// Account types for bank accounts
export type AccountType = 'savings' | 'checking'

// Community member roles
export type CommunityMemberRole = 'owner' | 'member'

// Removed legacy subscription and billing types

// User types
export interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: UserRole
  profile_picture?: string
  bio?: string
  socials?: UserSocials
  created_at: string
  updated_at: string
}

// Personalized email types
export interface UserEmail {
  id: string
  user_id: string
  email_address: string
  inbound_address_id?: string | null
  inbound_endpoint_id?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserEmailMessage {
  id: string
  user_id: string
  email_address: string
  message_type: 'sent' | 'received'
  inbound_email_id?: string | null
  from_email: string
  from_name?: string | null
  to_email: string
  to_name?: string | null
  subject: string
  html_content?: string | null
  text_content?: string | null
  is_read: boolean
  read_at?: string | null
  is_archived: boolean
  archived_at?: string | null
  received_at?: string | null
  sent_at?: string
  created_at: string
  updated_at: string
}

// Bank account types
export interface BankAccount {
  id: string
  account_name: string
  bank_name: string
  account_number: string
  account_type: AccountType
  community_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Removed legacy subscription plan types

// Community pricing types
export type CommunityPricingType = 'free' | 'one_time' | 'monthly' | 'annual' | 'recurring'

// Community types
export interface Community {
  id: string
  name: string
  slug: string
  description?: string
  owner_id: string
  logo_url?: string
  banner_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Community member types
export interface CommunityMember {
  id: string
  community_id: string
  user_id: string
  role: CommunityMemberRole
  joined_at: string
}

export interface UserFollow {
  follower_id: string
  followed_id: string
  created_at: string
}

export interface UserFollowStats {
  user_id: string
  followers_count: number
  following_count: number
}

// Removed legacy payment receipt types

// New balance system types
export interface PlatformSettings {
  id: number
  buy_price_per_point: number
  user_value_per_point: number
  stream_start_cost: number // Points charged to create/start a stream (goes to platform)
  stream_join_cost: number // Points charged to join a stream (goes to event owner)
  storage_purchase_price_per_gb?: number // One-time purchase price per GB in points
  storage_monthly_cost_per_gb?: number // Monthly cost per GB in points (for storage over 1 GB free)
  payout_minimum_ttd: number
  mandatory_topup_ttd: number
  holiday_mode?: HolidayMode
  updated_at: string
}

export interface Wallet {
  user_id: string
  points_balance: number
  earnings_points: number
  locked_earnings_points: number
  next_topup_due_on?: string
  last_mandatory_topup_at?: string
  last_topup_at?: string
  last_topup_reminder_at?: string
  updated_at: string
}

export type TransactionType =
  | 'top_up'
  | 'payout'
  | 'payout_lock'
  | 'payout_release'
  | 'point_spend'
  | 'point_refund'
  | 'earning_credit'
  | 'earning_reversal'
  | 'referral_bonus'
export type TransactionStatus = 'pending' | 'verified' | 'rejected'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount_ttd?: number
  points_delta: number
  earnings_points_delta: number
  status: TransactionStatus
  bank_account_id?: string
  receipt_url?: string
  verified_by?: string
  verified_at?: string
  rejection_reason?: string
  recipient_user_id?: string // User who received points (NULL for platform fees)
  sender_user_id?: string // User who initiated the transaction (sender of payment/points)
  sender_name?: string // Name of the sender at the time of transaction (denormalized for audit trail)
  recipient_name?: string // Name of the recipient at the time of transaction (denormalized for audit trail)
  buy_price_per_point_at_time?: number // Historical buy price per point at transaction time
  user_value_per_point_at_time?: number // Historical user value per point at transaction time
  context?: Record<string, unknown>
  created_at: string
}

export type PlatformRevenueType =
  | 'topup_profit'
  | 'voice_note_fee'
  | 'live_event_fee'
  | 'referral_expense'
  | 'user_earnings_expense'

export interface PlatformRevenueLedgerEntry {
  id: string
  transaction_id?: string
  revenue_type: PlatformRevenueType
  amount_ttd: number // Positive for revenue, negative for expenses
  points_involved: number
  buy_price_per_point?: number // Historical buy price (for topups only)
  user_value_per_point: number // Historical user value (for all types)
  is_liquid: boolean // True if revenue is available for withdrawal
  bank_account_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type WalletEarningStatus = 'pending' | 'confirmed' | 'locked' | 'reversed'
// Note: 'available' and 'paid' from migration file are not used - use 'confirmed' instead
// confirmed_at and reversed_at columns removed as redundant with status field

export interface WalletEarningsLedgerEntry {
  id: string
  user_id: string
  source_type: 'boost' | 'live_registration' | 'manual_adjustment' | 'storage_credit'
  source_id?: string
  community_id?: string
  points: number // Column name is "points", not "points_amount" as in outdated migration files
  amount_ttd?: number
  status: WalletEarningStatus
  available_at?: string // Column name is "available_at", not "release_at" as in outdated migration files
  created_at: string
  metadata?: Record<string, unknown>
  // Note: confirmed_at and reversed_at removed - status field is sufficient
}

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'cancelled'

export interface Payout {
  id: string
  user_id: string
  points: number
  amount_ttd: number
  status: PayoutStatus
  scheduled_for: string
  created_at: string
  processed_at?: string
  processed_by?: string
  transaction_id?: string
  notes?: string
  locked_points: number
}

export type PlatformWithdrawalStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed'

export interface PlatformWithdrawal {
  id: string
  bank_account_id: string
  amount_ttd: number
  status: PlatformWithdrawalStatus
  requested_by: string
  processed_by?: string
  requested_at: string
  processed_at?: string
  notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  bank_account?: BankAccount
  requested_by_user?: User
  processed_by_user?: User
}

// Topic types
export interface Topic {
  id: string
  slug: string
  label: string
  description?: string
  is_featured?: boolean
  is_active?: boolean
  created_by?: string | null
  created_at?: string
}

// Post system types
export type MediaType = 'image' | 'video' | 'document' | 'audio'

export interface Post {
  id: string
  community_id: string
  author_id: string
  content: string
  is_pinned: boolean
  parent_post_id?: string | null
  depth: number
  created_at: string
  updated_at: string
  published_at?: string
  boost_reward_message?: string | null
  media?: PostMedia[]
  boost_count?: number
  user_has_boosted?: boolean
  can_unboost?: boolean
  user_has_saved?: boolean
}

export interface PostBoost {
  id: string
  post_id: string
  user_id: string
  earnings_ledger_id?: string | null
  created_at: string
}

export interface PostMedia {
  id: string
  post_id?: string
  media_type: MediaType
  storage_path: string
  file_name: string
  file_size?: number
  mime_type?: string
  display_order: number
  requires_boost?: boolean
  created_at?: string
}

export type PostAuthorSummary = Pick<User, 'id' | 'username' | 'first_name' | 'last_name' | 'profile_picture' | 'bio'>

export interface PostWithAuthor extends Post {
  author: PostAuthorSummary
}

export interface HierarchicalPost extends PostWithAuthor {
  replies?: PostWithAuthor[]
}

export type DMParticipantStatus = 'pending' | 'active' | 'blocked' | 'archived'
export type DMMessageType = 'text' | 'system'
export type DMAttachmentType = 'image' | 'audio' | 'file' | 'video'

export interface DirectMessageThread {
  id: string
  user_a_id: string
  user_b_id: string
  initiated_by: string
  created_at: string
  updated_at: string
  last_message_at?: string | null
  last_message_preview?: string | null
  last_message_sender_id?: string | null
  request_required: boolean
  request_resolved_at?: string | null
}

export interface DirectMessageParticipant {
  id: string
  thread_id: string
  user_id: string
  status: DMParticipantStatus
  last_seen_at?: string | null
  last_read_at?: string | null
  muted_at?: string | null
  created_at: string
  updated_at: string
}

export interface DirectMessageReadReceipt {
  id: string
  message_id: string
  user_id: string
  read_at: string
}

export interface DirectMessage {
  id: string
  thread_id: string
  sender_id: string
  message_type: DMMessageType
  content?: string | null
  metadata?: Record<string, unknown> | null
  has_attachments: boolean
  reply_to_message_id?: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean
  attachments?: DirectMessageAttachment[]
  read_receipts?: DirectMessageReadReceipt[]
}

export interface DirectMessageAttachment {
  id: string
  message_id: string
  media_type: DMAttachmentType
  storage_path: string
  mime_type?: string | null
  file_size?: number | null
  duration_seconds?: number | null
  file_name?: string | null
  created_at: string
}

export interface DirectMessageConversationSummary {
  thread_id: string
  user_a_id: string
  user_b_id: string
  initiated_by: string
  request_required: boolean
  request_resolved_at?: string | null
  last_message_at?: string | null
  last_message_preview?: string | null
  last_message_sender_id?: string | null
  updated_at: string
  user_id: string
  participant_status: DMParticipantStatus
  last_read_at?: string | null
  last_seen_at?: string | null
  muted_at?: string | null
  other_user_id: string
  other_participant_status?: DMParticipantStatus | null
  other_last_read_at?: string | null
  other_last_seen_at?: string | null
  other_muted_at?: string | null
}

// Notification system types
export type NotificationType = 
  | 'new_message'
  | 'post_comment'
  | 'post_boost'
  | 'community_invite'
  | 'payment_verified'
  | 'event_reminder'
  | 'follow'
  | 'mention'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  action_url?: string | null
  metadata?: Record<string, unknown> | null
  is_read: boolean
  read_at?: string | null
  created_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  user_agent?: string | null
  created_at: string
  updated_at: string
}

// Event system types
export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export interface CommunityEvent {
  id: string
  community_id: string
  owner_id: string
  description?: string
  scheduled_at: string
  started_at?: string
  ended_at?: string
  status: EventStatus
  stream_call_id?: string // GetStream call ID
  points_charged: number // Amount charged to owner for starting
  created_at: string
  updated_at: string
  // Joined fields
  owner?: User
  community?: Community
  registration_count?: number
  user_has_registered?: boolean
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  points_charged: number
  registered_at: string
  joined_at?: string
  cancelled_at?: string
  refunded_at?: string
  // Joined fields
  user?: User
  event?: CommunityEvent
}

export interface EventRecording {
  id: string
  event_id: string
  community_id: string
  stream_recording_id: string
  storage_path?: string
  storage_url?: string
  stream_recording_url?: string
  post_id?: string
  title?: string
  description?: string
  duration_seconds?: number
  file_size_bytes?: number
  started_at?: string
  ended_at?: string
  is_processing?: boolean
  created_at: string
  saved_at?: string
  // Joined fields for storage page
  event?: CommunityEvent
  community?: Community
}

export interface UploadedVideo {
  id: string
  community_id: string
  user_id: string
  title?: string | null
  description?: string | null
  storage_path?: string | null
  storage_url?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
  created_at: string
  updated_at?: string
  community?: {
    id: string
    name: string
    slug: string
  } | null
  uploader?: {
    id: string
    username: string
    first_name: string
    last_name: string
  } | null
}

export type PlaylistStatus = 'draft' | 'published'

export interface CommunityPlaylist {
  id: string
  community_id: string
  owner_id: string
  title: string
  description?: string | null
  status: PlaylistStatus
  published_at?: string | null
  created_at: string
  updated_at: string
  items?: CommunityPlaylistItem[]
}

export interface CommunityPlaylistItem {
  id: string
  playlist_id: string
  event_recording_id?: string | null
  uploaded_video_id?: string | null
  position: number
  created_at: string
  event_recording?: EventRecording | null
  uploaded_video?: UploadedVideo | null
}

export interface UserStorage {
  user_id: string
  total_storage_bytes: number
  storage_limit_bytes: number
  monthly_cost_points: number
  last_billing_date?: string
  last_calculated_at: string
  created_at: string
  updated_at: string
}

// CRM types
export type CrmLeadSource = 'tiktok' | 'whatsapp' | 'instagram' | 'email' | 'referral' | 'website' | 'other'
export type CrmConversationChannel = 'tiktok' | 'whatsapp' | 'instagram' | 'email' | 'phone' | 'other'
export type CrmContactType = 'email' | 'phone' | 'tiktok' | 'whatsapp' | 'instagram' | 'other'

export interface CrmStage {
  id: string
  name: string
  description?: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CrmLeadContact {
  id: string
  lead_id: string
  contact_type: CrmContactType
  value: string
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CrmLead {
  id: string
  name: string
  source: CrmLeadSource
  stage_id: string
  sort_order: number
  potential_revenue_ttd?: number
  close_date?: string
  close_revenue_ttd?: number
  contacted_date?: string
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  stage?: CrmStage
  created_by_user?: User
  contacts?: CrmLeadContact[]
}

export interface CrmConversation {
  id: string
  lead_id: string
  created_at: string
  updated_at: string
  // Joined fields
  sessions?: CrmConversationSession[]
}

export interface CrmConversationSession {
  id: string
  conversation_id: string
  channel: CrmConversationChannel
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  created_by_user?: User
}

export interface CrmNote {
  id: string
  lead_id: string
  content: string
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  created_by_user?: User
}

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      bank_accounts: {
        Row: BankAccount
        Insert: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>>
      }
      communities: {
        Row: Community
        Insert: Omit<Community, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Community, 'id' | 'created_at' | 'updated_at'>>
      }
      community_members: {
        Row: CommunityMember
        Insert: Omit<CommunityMember, 'id' | 'joined_at'>
        Update: Partial<Omit<CommunityMember, 'id' | 'joined_at'>>
      }
      platform_settings: {
        Row: PlatformSettings
        Insert: Partial<PlatformSettings>
        Update: Partial<PlatformSettings>
      }
      wallets: {
        Row: Wallet
        Insert: Omit<Wallet, 'updated_at'>
        Update: Partial<Wallet>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at'>
        Update: Partial<Transaction>
      }
      wallet_earnings_ledger: {
        Row: WalletEarningsLedgerEntry
        Insert: never
        Update: never
      }
      payouts: {
        Row: Payout
        Insert: never
        Update: never
      }
      posts: {
        Row: Post
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'published_at'>
        Update: Partial<Omit<Post, 'id' | 'created_at' | 'updated_at'>>
      }
      post_media: {
        Row: PostMedia
        Insert: Omit<PostMedia, 'id' | 'created_at'>
        Update: Partial<Omit<PostMedia, 'id' | 'created_at'>>
      }
      community_playlists: {
        Row: CommunityPlaylist
        Insert: Omit<CommunityPlaylist, 'id' | 'created_at' | 'updated_at' | 'items'> & {
          id?: string
        }
        Update: Partial<Omit<CommunityPlaylist, 'id' | 'created_at' | 'updated_at' | 'items'>>
      }
      community_playlist_items: {
        Row: CommunityPlaylistItem
        Insert: Omit<CommunityPlaylistItem, 'id' | 'created_at' | 'event_recording' | 'uploaded_video'> & {
          id?: string
        }
        Update: Partial<Omit<CommunityPlaylistItem, 'id' | 'created_at' | 'event_recording' | 'uploaded_video'>>
      }
      user_follows: {
        Row: UserFollow
        Insert: {
          follower_id: string
          followed_id: string
          created_at?: string
        }
        Update: Partial<UserFollow>
      }
      dm_threads: {
        Row: DirectMessageThread
        Insert: {
          user_a_id: string
          user_b_id: string
          initiated_by: string
          request_required?: boolean
          request_resolved_at?: string | null
        }
        Update: Partial<DirectMessageThread>
      }
      dm_participants: {
        Row: DirectMessageParticipant
        Insert: {
          thread_id: string
          user_id: string
          status?: DMParticipantStatus
          last_seen_at?: string | null
          last_read_at?: string | null
          muted_at?: string | null
        }
        Update: Partial<DirectMessageParticipant>
      }
      dm_messages: {
        Row: DirectMessage
        Insert: {
          thread_id: string
          sender_id: string
          message_type?: DMMessageType
          content?: string | null
          metadata?: Record<string, unknown> | null
          has_attachments?: boolean
          reply_to_message_id?: string | null
          is_deleted?: boolean
        }
        Update: Partial<Omit<DirectMessage, 'attachments'>>
      }
      dm_message_media: {
        Row: DirectMessageAttachment
        Insert: {
          message_id: string
          media_type: DMAttachmentType
          storage_path: string
          mime_type?: string | null
          file_size?: number | null
          duration_seconds?: number | null
        }
        Update: Partial<DirectMessageAttachment>
      }
      dm_message_reads: {
        Row: DirectMessageReadReceipt
        Insert: {
          message_id: string
          user_id: string
          read_at?: string
        }
        Update: Partial<DirectMessageReadReceipt>
      }
    }
    Views: {
      dm_conversation_summaries: {
        Row: DirectMessageConversationSummary
      }
      user_follow_stats: {
        Row: UserFollowStats
      }
    }
  }
}
