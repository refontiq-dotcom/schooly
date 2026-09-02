import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schooly",
  description:
    "Inscriptions en ligne, suivi des présences, notes et communication avec les parents.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Schooly",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
