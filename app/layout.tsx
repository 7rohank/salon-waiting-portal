import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salon Waiting Portal",
  description: "A live waiting-list portal for salon walk-ins and staff.",
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
