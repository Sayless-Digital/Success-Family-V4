import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalLayout } from "@/components/layout/global-layout";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ScrollbarProvider } from "@/components/scrollbar-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Success Family Platform",
  description: "A community platform for success-driven individuals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
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
