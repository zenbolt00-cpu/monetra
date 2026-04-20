import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Montera | Financial Accounts Management",
  description: "Faithful financial data extraction and management for vendors and administrators.",
};

import Providers from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={cn(
        "min-h-screen font-sans antialiased",
      )}>
        <Providers>{children}</Providers>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            className: 'glass border-black/5 rounded-2xl backdrop-blur-xl',
            style: {
              background: 'rgba(255, 255, 255, 0.7)',
              color: '#1d1d1f',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '20px',
              backdropFilter: 'blur(20px)',
              fontWeight: '500',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#28cd41',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff3b30',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}

