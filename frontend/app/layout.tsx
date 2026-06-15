import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiveAvatar Consulting",
  description: "AI-powered live avatar consultant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
