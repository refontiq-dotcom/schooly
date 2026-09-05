"use client";

import { useRef, useState } from "react";
import { Mic, Paperclip, Send, Sparkles } from "lucide-react";

export interface PromptInputProps {
  placeholder?: string;
  suggestions?: string[];
  onSubmit?: (value: string) => void;
  className?: string;
}

export default function PromptInput({
  placeholder = "Demander à l'assistant Schooly…",
  suggestions = [],
  onSubmit,
  className = "",
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize façon Gemini
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  }

  function pickSuggestion(text: string) {
    setValue(text);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResize();
    });
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Puces de suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="list" aria-label="Suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              role="listitem"
              onClick={() => pickSuggestion(s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-3.5 py-1.5 text-[13px] text-muted transition-all duration-200 hover:bg-hover hover:text-text hover:border-accent-primary/30 active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Champ d'interaction */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-3xl border border-subtle bg-surface p-2 transition-all duration-200 focus-within:border-accent-primary/40"
      >
        <label htmlFor="gemini-prompt" className="sr-only">
          Demander à l&apos;assistant Schooly
        </label>
        <textarea
          id="gemini-prompt"
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-40 w-full resize-none bg-transparent px-4 py-3 text-[15px] text-text placeholder-muted outline-none"
        />
        <div className="flex items-center justify-between px-1.5 pb-0.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Joindre un fichier"
              title="Joindre un fichier"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-hover hover:text-text"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Dicter"
              title="Dicter"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-hover hover:text-text"
            >
              <Mic className="h-[18px] w-[18px]" />
            </button>
          </div>
          <button
            type="submit"
            aria-label="Envoyer"
            disabled={!value.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary text-[#062e43] transition-all duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-hover disabled:text-muted"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted">
        L&apos;assistant peut se tromper — vérifiez les informations importantes.
      </p>
    </div>
  );
}
