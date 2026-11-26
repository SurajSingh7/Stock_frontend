'use client'

import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { PermissionProvider } from "../context/PermissionContext";
import { ZoomProvider } from "@/layouts/header/components/zoom/ZoomProvider";
import Header from "@/layouts/header/Header";
import Footer from "@/shared/ui/footer/Footer";
import PermissionGuard from "@/shared/guards/PermissionGuard";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
          <PermissionProvider>
            <ZoomProvider>
              {/* Exactly one screen tall at any zoom (see ZoomProvider), the
                  page filling whatever the header and footer leave — so the
                  footer sits at the bottom, never mid-screen. */}
              <div className="relative flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
                <Toaster />
                <Header />
                <div className="flex flex-1 flex-col bg-white text-gray-700 *:flex-1">
                  <PermissionGuard>{children}</PermissionGuard>
                </div>
                <Footer />
              </div>
            </ZoomProvider>
          </PermissionProvider>
      </body>
    </html>
  );
}