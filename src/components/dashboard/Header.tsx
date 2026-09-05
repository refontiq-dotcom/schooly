"use client";

import Link from "next/link";
import { Bell, Menu, Search, Sparkles } from "lucide-react";

export interface HeaderProps {
  /** Chemins du fil d'Ariane, ex. ["Dashboard", "Vue d'ensemble"] */
  breadcrumb: string[];
  /** Déclenche l'ouverture de la modale d'actions rapides */
  onQuickEntry: () => void;
  /** Ouvre le volet de navigation mobile */
  onMobileMenu: () => void;
  /** Slot optionnel à droite (recherche, sélecteurs, …) */
  children?: React.ReactNode;
}

export default function Header({ breadcrumb, onQuickEntry, onMobileMenu, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#131314]/80 border-b border-subtle">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        <button
          type="button"
          onClick={onMobileMenu}
          aria-label="Ouvrir le menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-hover hover:text-text lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm">
            {breadcrumb.map((crumb, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <li key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <span className="text-muted/60 select-none">/</span>}
                  {last ? (
                    <span className="font-medium text-text truncate" aria-current="page">
                      {crumb}
                    </span>
                  ) : (
                    <Link href="/dashboard/admin" className="text-muted hover:text-text transition-all duration-200 truncate">
                      {crumb}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="hidden md:flex items-center gap-2 rounded-full bg-hover px-3.5 h-10 w-56 focus-within:ring-1 focus-within:ring-accent-primary/50 transition-all duration-200">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="search"
            placeholder="Rechercher…"
            aria-label="Rechercher"
            className="w-full bg-transparent text-sm text-text placeholder-muted outline-none"
          />
        </div>

        {/* Badge assistant IA */}
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-text">
          <Sparkles className="w-3.5 h-3.5 text-accent-primary gemini-sparkle" />
          Assistant IA
        </span>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-hover hover:text-text"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-primary" />
        </button>

        {children}
      </div>
    </header>
  );
}
