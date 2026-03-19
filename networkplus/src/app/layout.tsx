import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FcmInitializer from "@/components/fcm-initializer";
import Navbar from "@/components/navbar";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { OnboardingTour } from "@/components/onboarding-tour";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NetworkPlus",
  description: "Manage and visualize your personal network",
  verification: {
    google: "en2ijfi_fxmYixn9I5hWErnKCrRyTGqAhbyMIse26eY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <FcmInitializer />
            <div className="flex h-full flex-col overflow-hidden">
              <Navbar />
              <main className="min-h-0 flex-1 overflow-auto overscroll-contain">
                {children}
              </main>
            </div>
            <OnboardingTour />
          </SessionProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}

