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

// Billing cycle types
export type BillingCycle = 'monthly' | 'annual'

// Payment status types
export type PaymentStatus = 'pending' | 'verified' | 'rejected'

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
  is_active: boolean
  created_at: string
  updated_at: string
}

// Subscription plan types
export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  monthly_price: number
  annual_price: number
  tags: string[]
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// Community types
export interface Community {
  id: string
  name: string
  slug: string
  description?: string
  owner_id: string
  plan_id: string
  billing_cycle: BillingCycle
  subscription_start_date?: string
  subscription_end_date?: string
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

// Payment receipt types
export interface PaymentReceipt {
  id: string
  community_id: string
  user_id: string
  plan_id: string
  billing_cycle: BillingCycle
  amount: number
  bank_account_id: string
  receipt_url: string
  status: PaymentStatus
  verified_by?: string
  verified_at?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

// Post types
export interface Post {
  id: string
  title: string
  content: string
  author_id: string
  community_id: string
  created_at: string
  updated_at: string
  published: boolean
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
      subscription_plans: {
        Row: SubscriptionPlan
        Insert: Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>>
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
      payment_receipts: {
        Row: PaymentReceipt
        Insert: Omit<PaymentReceipt, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PaymentReceipt, 'id' | 'created_at' | 'updated_at'>>
      }
      posts: {
        Row: Post
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Post, 'id' | 'created_at' | 'updated_at'>>
      }
      comments: {
        Row: Comment
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Comment, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
