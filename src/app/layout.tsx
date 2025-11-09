import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalLayout } from "@/components/layout/global-layout";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ScrollbarProvider } from "@/components/scrollbar-provider";
import { HMRErrorSuppressor } from "@/components/hmr-error-suppressor";

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
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
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
            <GlobalLayout>
              {children}
            </GlobalLayout>
          </AuthProvider>
        </ScrollbarProvider>
      </body>
    </html>
  );
}
