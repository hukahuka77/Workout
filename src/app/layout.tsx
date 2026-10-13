import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workout",
  description: "Train. Track. Progress.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Workout", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#f5f9f7", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
