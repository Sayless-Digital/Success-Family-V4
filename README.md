# Success Family Platform

A modern community platform built with Next.js, shadcn/ui, and Supabase.

<!-- Version: 2025.01 -->

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4.1.16 (latest) with shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Email**: Resend API for transactional emails
- **Package Manager**: pnpm
- **Development**: Turbopack for fast development

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm
- Supabase account

### Installation

1. Clone the repository and install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp env.template .env
```

3. Configure your Supabase project:
   - Create a new Supabase project
   - Copy your project URL and anon key to `.env`
   - Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📖 Documentation

- **[Setup Guide](SETUP.md)** - Quick setup instructions
- **[Database Migrations](docs/MIGRATIONS.md)** - Database schema and migration history
- **[Authentication Setup](docs/AUTH_SETUP_GUIDE.md)** - Authentication system setup
- **[Sidebar Navigation](docs/SIDEBAR_NAVIGATION.md)** - Navigation architecture

## Project Structure

```
.
├── src/                    # Source code
│   ├── app/               # Next.js App Router
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/        # React components
│   │   └── ui/           # shadcn/ui components
│   ├── lib/              # Utility functions
│   │   ├── supabase.ts   # Supabase client
│   │   └── utils.ts      # Utility functions
│   └── types/            # TypeScript type definitions
├── supabase/
│   └── migrations/       # Database migration files
├── docs/                 # Documentation files
├── README.md             # This file
├── SETUP.md              # Quick setup guide
└── package.json          # Dependencies
```

## Available Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Features

- ⚡ Fast development with Turbopack
- 🎨 Beautiful UI with shadcn/ui components
- 🔐 Authentication with Supabase
- 📱 Responsive design
- 🌙 Dark mode support
- 📊 Real-time data with Supabase
- 🚀 Latest Tailwind CSS v4 with PostCSS integration
- 🧭 Context-aware sidebar navigation
- 👥 Community management and membership
- 💳 Subscription-based communities
- 🏦 Payment receipt verification system

## Next Steps

1. Follow the [Setup Guide](SETUP.md) to configure your environment
2. Apply database migrations from `supabase/migrations/`
3. Review the [Authentication Setup](docs/AUTH_SETUP_GUIDE.md)
4. Start building your community features!

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
