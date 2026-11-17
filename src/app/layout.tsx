import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import AppToaster from "@/components/ui/AppToaster";
import UpdateNotice from "@/components/ui/UpdateNotice";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Puzzle Generator: print-ready puzzle books", template: "%s · Puzzle Generator" },
  description: "Create word search, crossword and sudoku puzzles and export print-ready KDP book interiors.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <a href="#main" className="visually-hidden-focusable btn btn-primary position-absolute m-2" style={{ zIndex: 2000 }}>
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        <AppToaster />
        <UpdateNotice />
      </body>
    </html>
  );
}
