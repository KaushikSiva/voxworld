import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HumanVoice",
  description: "Human-backed voice agent demo gated by verification."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
