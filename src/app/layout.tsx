import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalLayout } from "@/components/layout/global-layout";
import { AuthProvider } from "@/components/auth-provider";
import { OnlineStatusProvider } from "@/components/online-status-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ScrollbarProvider } from "@/components/scrollbar-provider";
import { HMRErrorSuppressor } from "@/components/hmr-error-suppressor";
import { TopUpBonusProvider } from "@/components/topup-bonus-provider";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: "Success Family Platform",
  description: "A community platform for success-driven individuals",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.svg", type: "image/svg+xml" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <HMRErrorSuppressor />
        <ScrollbarProvider>
          <AuthProvider>
            <TopUpBonusProvider />
            <OnlineStatusProvider>
              <GlobalLayout>
                {children}
              </GlobalLayout>
            </OnlineStatusProvider>
          </AuthProvider>
        </ScrollbarProvider>
      </body>
    </html>
  );
}
