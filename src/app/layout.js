'use client'

import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { PermissionProvider } from "../context/PermissionContext";
import { ZoomProvider } from "@/layouts/header/components/zoom/ZoomProvider";
import Header from "@/layouts/header/Header";
import Footer from "@/shared/ui/footer/Footer";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
          <PermissionProvider>
            <ZoomProvider>
              <div className="relative">
                <Toaster />
                <Header />
                <div className="min-h-screen bg-white text-gray-700">
                  {/* <PermissionGuard> */}
                    {children}
                  {/* </PermissionGuard> */}
                </div>
                <Footer />
              </div>
            </ZoomProvider>
          </PermissionProvider>
      </body>
    </html>
  );
}