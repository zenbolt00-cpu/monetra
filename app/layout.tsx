import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Monetra | Financial Intelligence Platform",
  description: "Enterprise-grade financial data extraction, reconciliation and management for vendors and administrators.",
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
        "min-h-screen antialiased",
      )}>
        <Providers>{children}</Providers>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            className: 'glass-modal',
            style: {
              background: 'rgba(255, 255, 255, 0.82)',
              color: '#1d1d1f',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              borderRadius: '20px',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              fontWeight: '500',
              fontSize: '14px',
              letterSpacing: '-0.01em',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              padding: '14px 20px',
            },
            success: {
              iconTheme: {
                primary: '#32D74B',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#FF453A',
                secondary: '#fff',
              },
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
