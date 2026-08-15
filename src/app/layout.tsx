import type { Metadata } from "next";

import { PublicHeaderBoundary } from "@/components/shared/navigation-visibility";
import { SiteHeader } from "@/components/shared/site-header";

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
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <PublicHeaderBoundary>
          <SiteHeader />
        </PublicHeaderBoundary>
        {children}
      </body>
    </html>
  );
}
