import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Schooly",
    template: "%s — Schooly",
  },
  description:
    "SaaS de gestion d'établissements scolaires : classes, élèves, paiements, documents et communication avec les parents.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
