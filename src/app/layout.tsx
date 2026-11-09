import type { Metadata } from "next";

import { PublicHeaderBoundary } from "@/components/shared/navigation-visibility";
import { SiteHeader } from "@/components/shared/site-header";
import { ThemeProvider } from "@/components/shared/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "THPTMockTest",
    template: "%s | THPTMockTest",
  },
  description: "Ứng dụng luyện đề Toán THPT dành cho mục đích học tập cá nhân.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PublicHeaderBoundary>
            <SiteHeader />
          </PublicHeaderBoundary>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
