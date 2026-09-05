"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import {
  Layers,
  CalendarDays,
  Backpack,
  BedDouble,
  Wallet,
  MessagesSquare,
  FolderOpen,
  Megaphone,
  Users,
  FileText,
  BookOpen,
  Network,
  Home,
  Plus,
  Sparkles,
} from "lucide-react";
import Sidebar, { type SidebarNavSection } from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import GeminiModal from "@/components/dashboard/GeminiModal";
import PromptInput from "@/components/dashboard/PromptInput";

const navSections: SidebarNavSection[] = [
  {
    title: "",
    items: [{ href: "/dashboard/admin", label: "Vue d'ensemble", icon: Home }],
  },
  {
    title: "Scolarité",
    items: [
      { href: "/dashboard/admin/classes", label: "Classes", icon: Layers },
      { href: "/dashboard/admin/reservations", label: "Réservations", icon: CalendarDays },
      { href: "/dashboard/admin/rentree", label: "Rentrée", icon: Backpack },
    ],
  },
  {
    title: "Vie scolaire",
    items: [{ href: "/dashboard/admin/internat", label: "Internat", icon: BedDouble }],
  },
  {
    title: "Finance",
    items: [{ href: "/dashboard/admin/paiements", label: "Paiements", icon: Wallet }],
  },
  {
    title: "Communication",
    items: [
      { href: "/dashboard/admin/messages", label: "Messages", icon: MessagesSquare },
      { href: "/dashboard/admin/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    title: "Partenaires",
    items: [{ href: "/dashboard/admin/trouvetou", label: "Trouvetou", icon: Megaphone }],
  },
  {
    title: "Équipe",
    items: [
      { href: "/dashboard/admin/equipe", label: "Équipe", icon: Users },
      { href: "/dashboard/secretariat", label: "Secrétariat", icon: FileText },
      { href: "/dashboard/professeur", label: "Professeurs", icon: BookOpen },
    ],
  },
  {
    title: "Réseau",
    items: [{ href: "/dashboard/admin/reseau", label: "Mon réseau", icon: Network }],
  },
];

const AI_SUGGESTIONS = [
  "Combien d'élèves aujourd'hui ?",
  "Paiements en attente ?",
  "Classes presque pleines ?",
];

interface AdminLayoutProps {
  children: React.ReactNode;
  logoUrl: string | null;
  establishmentName: string;
  groupName: string | null;
  branches: { id: string; name: string; city: string; branch_name: string | null }[];
  currentBranchId: string | null;
  userName: string;
  userRole: string;
}

export default function AdminLayout({
  children,
  logoUrl,
  establishmentName,
  groupName,
  branches,
  currentBranchId,
  userName,
  userRole,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  // Le bouton "+ Saisie rapide" de la sidebar ouvre la modale via un événement global
  useEffect(() => {
    window.addEventListener("schooly:quick-entry", openModal);
    return () => window.removeEventListener("schooly:quick-entry", openModal);
  }, [openModal]);

  const currentItem = navSections
    .flatMap((s) => s.items)
    .find(
      (item) =>
        item.href === "/dashboard/admin"
          ? pathname === item.href
          : pathname.startsWith(item.href)
    );

  const currentLabel = currentItem?.label ?? "Vue d'ensemble";

  const QUICK_LINKS: Record<string, string> = {
    reservation: "/dashboard/admin/reservations",
    message: "/dashboard/admin/messages",
    document: "/dashboard/admin/documents",
    invite: "/dashboard/admin/equipe",
  };

  function handlePrompt(value: string) {
    setAiAnswer(
      `Requête transmise à l'assistant : « ${value} ». Les réponses en temps réel arrivent bientôt — en attendant, explorez les sections dédiées depuis la navigation.`
    );
  }

  return (
    <div className="gemini-dark flex h-screen overflow-hidden">
      <Sidebar
        logoUrl={logoUrl}
        establishmentName={establishmentName}
        groupName={groupName}
        branches={branches}
        currentBranchId={currentBranchId}
        sections={navSections}
        userName={userName}
        userRole={userRole}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          breadcrumb={["Dashboard", currentLabel]}
          onQuickEntry={openModal}
          onMobileMenu={() => setMobileOpen(true)}
        >
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent-primary px-4 text-sm font-semibold text-[#062e43] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Saisie rapide</span>
            <span className="sm:hidden">+</span>
          </button>
        </Header>

        <main className="relative flex-1 overflow-y-auto">
          {aiAnswer && (
            <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
              <div className="gemini-fade-up flex items-start gap-3 rounded-3xl border border-accent-primary/30 bg-accent-active/40 px-4 py-3 text-sm text-accent-text">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
                <span>{aiAnswer}</span>
                <button
                  type="button"
                  onClick={() => setAiAnswer(null)}
                  aria-label="Fermer la réponse"
                  className="ml-auto shrink-0 rounded-full px-1.5 text-accent-text/60 transition-all duration-200 hover:text-accent-text"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          {/* Barre d'interaction IA ancrée en bas de page */}
          <div className="pointer-events-none sticky bottom-0 z-20">
            <div className="pointer-events-auto mx-auto max-w-3xl px-4 pb-5 sm:px-6">
              <PromptInput suggestions={AI_SUGGESTIONS} onSubmit={handlePrompt} />
            </div>
          </div>
        </main>
      </div>

      <GeminiModal
        open={modalOpen}
        onClose={closeModal}
        onOptionSelect={(id) => {
          const href = QUICK_LINKS[id];
          closeModal();
          if (href) router.push(href);
        }}
      />
    </div>
  );
}
