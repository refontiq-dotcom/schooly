"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type AudioData = {
  studentName: string;
  attendanceRate: number | null;
  averageGrade: number | null;
  remainingPayment: number;
  missingDocs: number;
  hasAlerts: boolean;
};

type Props = {
  data: AudioData;
  children?: React.ReactNode;
};

/**
 * Bouton de lecture audio pour les parents illettrés.
 * Utilise la Web Speech API (synthèse vocale) pour lire
 * les informations de l'enfant à voix haute.
 */
export default function ParentAudio({ data, children }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported("speechSynthesis" in window);
  }, []);

  const buildMessage = useCallback(() => {
    const parts: string[] = [];

    parts.push(`Bonjour. Voici le suivi de ${data.studentName}.`);

    // Présence
    if (data.attendanceRate !== null) {
      if (data.attendanceRate >= 80) {
        parts.push(
          `La présence est bonne, à ${data.attendanceRate} pour cent.`
        );
      } else if (data.attendanceRate >= 60) {
        parts.push(
          `Attention, la présence est de ${data.attendanceRate} pour cent. Veuillez contacter l'établissement.`
        );
      } else {
        parts.push(
          `Alerte. La présence est faible, seulement ${data.attendanceRate} pour cent. Veuillez contacter l'établissement rapidement.`
        );
      }
    }

    // Notes
    if (data.averageGrade !== null) {
      if (data.averageGrade >= 14) {
        parts.push(
          `Les notes sont excellentes, avec une moyenne de ${data.averageGrade} sur 20.`
        );
      } else if (data.averageGrade >= 10) {
        parts.push(
          `Les notes sont correctes, avec une moyenne de ${data.averageGrade} sur 20.`
        );
      } else {
        parts.push(
          `Attention, les notes sont en dessous de la moyenne. La moyenne est de ${data.averageGrade} sur 20.`
        );
      }
    }

    // Paiements
    if (data.remainingPayment > 0) {
      parts.push(
        `Il reste ${data.remainingPayment} francs CFA à payer.`
      );
    } else {
      parts.push("Les paiements sont à jour.");
    }

    // Documents
    if (data.missingDocs > 0) {
      parts.push(
        `Attention, il manque ${data.missingDocs} document(s). Veuillez les déposer à l'établissement.`
      );
    } else {
      parts.push("Tous les documents sont complets.");
    }

    // Alerte globale
    if (data.hasAlerts) {
      parts.push(
        "Il y a des alertes importantes. Veuillez vérifier votre tableau de bord."
      );
    }

    parts.push("Fin du résumé.");

    return parts.join(" ");
  }, [data]);

  const speak = useCallback(() => {
    if (!isSupported) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const message = buildMessage();
    const utterance = new SpeechSynthesisUtterance(message);

    // Configuration for French voice
    utterance.lang = "fr-FR";
    utterance.rate = 0.85; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find a French voice
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(
      (v) => v.lang.startsWith("fr") || v.name.toLowerCase().includes("french")
    );
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, buildMessage]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    if (isSpeaking) {
      stop();
    } else {
      speak();
    }
  }, [isSpeaking, speak, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Load voices (they may not be available immediately)
  useEffect(() => {
    if (isSupported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, [isSupported]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      {children}
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all min-h-[52px] ${
          isSpeaking
            ? "bg-amber-500 text-white shadow-lg animate-pulse"
            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
        }`}
        aria-label={isSpeaking ? "Arrêter la lecture" : "Lire les informations à voix haute"}
      >
        <span className="text-xl">{isSpeaking ? "🔊" : "🗣️"}</span>
        <span>{isSpeaking ? "Écouter..." : "Écouter"}</span>
        {isSpeaking && (
          <span className="flex gap-0.5">
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * Composant cliquable qui lit son contenu à voix haute au clic.
 * Utile pour les parents illettrés qui veulent écouter une information spécifique.
 */
export function SpeakableCard({
  text,
  emoji,
  label,
  children,
}: {
  text: string;
  emoji: string;
  label: string;
  children: React.ReactNode;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(() => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.85;

    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(
      (v) => v.lang.startsWith("fr") || v.name.toLowerCase().includes("french")
    );
    if (frenchVoice) utterance.voice = frenchVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [text]);

  return (
    <button
      type="button"
      onClick={speak}
      className={`text-left w-full transition-all active:scale-95 ${
        isSpeaking ? "ring-2 ring-amber-400 ring-offset-2" : ""
      }`}
      aria-label={`${label} — appuyez pour écouter`}
    >
      {children}
    </button>
  );
}
