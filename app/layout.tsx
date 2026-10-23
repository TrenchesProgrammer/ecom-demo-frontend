import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Storefront",
  description: "Basic interface consuming /api/products and /api/buy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 py-10">
        {children}
      </body>
    </html>
  );
}
