import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veloura Atelier",
  description: "A refined salon queue and guest-flow portal for premium studio operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}