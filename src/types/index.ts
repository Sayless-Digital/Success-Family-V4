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

// Community types
export interface Community {
  id: string
  name: string
  description?: string
  slug: string
  created_at: string
  updated_at: string
  owner_id: string
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
      communities: {
        Row: Community
        Insert: Omit<Community, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Community, 'id' | 'created_at' | 'updated_at'>>
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
