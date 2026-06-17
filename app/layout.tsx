import React from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "OptionPilot",
  description: "AI-Powered Options Scanner",
};

export const viewport = {
  themeColor: "#dc2626",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
