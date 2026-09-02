import Link from "next/link";
import { IconBackpack, IconChat, IconFile, IconHome, IconWallet } from "@/components/icons";

const items = [
  { href: "/dashboard/parent", label: "Suivi", icon: IconHome },
  { href: "/dashboard/parent/rentree", label: "Rentrée", icon: IconBackpack },
  { href: "/dashboard/parent/paiements", label: "Paiements", icon: IconWallet },
  { href: "/dashboard/parent/documents", label: "Documents", icon: IconFile },
  { href: "/dashboard/parent/messages", label: "Messages", icon: IconChat },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Espace parent">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-amber-300 hover:text-amber-700 transition-colors whitespace-nowrap"
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
