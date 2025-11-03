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

// Removed legacy payment receipt types

// New balance system types
export interface PlatformSettings {
  id: number
  buy_price_per_point: number
  user_value_per_point: number
  stream_start_cost: number // Points charged to create/start a stream (goes to platform)
  stream_join_cost: number // Points charged to join a stream (goes to event owner)
  updated_at: string
}

export interface Wallet {
  user_id: string
  points_balance: number
  last_topup_at?: string
  updated_at: string
}

export type TransactionType = 'top_up' | 'payout' | 'point_spend' | 'point_refund'
export type TransactionStatus = 'pending' | 'verified' | 'rejected'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount_ttd?: number
  points_delta: number
  status: TransactionStatus
  bank_account_id?: string
  receipt_url?: string
  verified_by?: string
  verified_at?: string
  rejection_reason?: string
  recipient_user_id?: string // User who received points (NULL for platform fees)
  created_at: string
}

// Post system types
export type MediaType = 'image' | 'video' | 'document' | 'audio'

export interface Post {
  id: string
  community_id: string
  author_id: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  published_at?: string
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
  created_at?: string
}

// Comment types
export interface Comment {
  id: string
  content: string
  author_id: string
  post_id: string
  parent_id?: string
  created_at: string
  updated_at: string
}

// Event system types
export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export interface CommunityEvent {
  id: string
  community_id: string
  owner_id: string
  title: string
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
  stream_recording_id: string
  storage_path?: string
  post_id?: string
  duration_seconds?: number
  file_size_bytes?: number
  created_at: string
  saved_at?: string
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
      comments: {
        Row: Comment
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Comment, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
