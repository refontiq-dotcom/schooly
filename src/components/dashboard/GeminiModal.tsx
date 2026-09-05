"use client";

import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, MessageSquarePlus, FileUp, UserPlus, X } from "lucide-react";

export interface QuickActionOption {
  id: string;
  label: "Nouvelle réservation" | "Écrire aux parents" | "Déposer un document" | "Inviter un membre";
  description: string;
  icon: LucideIcon;
}

export interface GeminiModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  options?: QuickActionOption[];
  /** Appelé avec l'id de l'option cliquée (si non fourni, ferme simplement) */
  onOptionSelect?: (id: string) => void;
  /** Contenu libre alternatif aux options */
  children?: React.ReactNode;
}

const DEFAULT_OPTIONS: QuickActionOption[] = [
  {
    id: "reservation",
    label: "Nouvelle réservation",
    description: "Créer un dossier d'inscription manuellement",
    icon: CalendarPlus,
  },
  {
    id: "message",
    label: "Écrire aux parents",
    description: "Diffuser une information à une classe",
    icon: MessageSquarePlus,
  },
  {
    id: "document",
    label: "Déposer un document",
    description: "Bulletins, certificats, circulaires",
    icon: FileUp,
  },
  {
    id: "invite",
    label: "Inviter un membre",
    description: "Professeur, secrétariat, censeur",
    icon: UserPlus,
  },
];

export default function GeminiModal({
  open,
  onClose,
  title = "Que souhaitez-vous faire ?",
  description = "Choisissez une action — l'assistant vous guide.",
  options = DEFAULT_OPTIONS,
  onOptionSelect,
  children,
}: GeminiModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="gemini-fade-up w-full max-w-lg rounded-3xl border border-subtle bg-surface p-6 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-hover hover:text-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children ?? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => (onOptionSelect ? onOptionSelect(o.id) : onClose())}
                className="group flex items-start gap-3 rounded-2xl border border-subtle bg-[#222324] p-4 text-left transition-all duration-200 hover:border-accent-primary/40 hover:bg-hover active:scale-[0.98]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-active text-accent-text">
                  <o.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{o.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{o.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
