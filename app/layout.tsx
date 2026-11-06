import type { Metadata } from "next";
import "./globals.css";
import "./operations-theme.css";

export const metadata: Metadata = {
  title: "Shelfday — Daily kitchen operations",
  description: "Plan your prep, use ingredients in time, and close the day with every portion accounted for.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
