"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface LogoUploaderProps {
  establishmentId: string;
  currentLogoUrl: string | null;
  onLogoUploaded?: (url: string) => void;
}

export default function LogoUploader({
  establishmentId,
  currentLogoUrl,
  onLogoUploaded,
}: LogoUploaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Le fichier ne doit pas dépasser 2 Mo");
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setError("Format non supporté (PNG, JPG, WebP, SVG uniquement)");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${establishmentId}/logo.${ext}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split("/establishment-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("establishment-logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("establishment-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("establishment-logos").getPublicUrl(path);

      // Update establishment
      const { error: updateError } = await supabase
        .from("establishments")
        .update({ logo_url: publicUrl })
        .eq("id", establishmentId);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      onLogoUploaded?.(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700">
        Logo de l&apos;établissement
      </label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logo"
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl text-slate-300">🏫</span>
          )}
        </div>

        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {uploading ? "Envoi en cours…" : logoUrl ? "Changer le logo" : "Ajouter un logo"}
          </button>
          <p className="text-xs text-slate-400 mt-1">
            PNG, JPG, WebP ou SVG — max 2 Mo
          </p>
          {logoUrl && (
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                const path = logoUrl.split("/establishment-logos/")[1];
                if (path) {
                  await supabase.storage.from("establishment-logos").remove([path]);
                }
                await supabase
                  .from("establishments")
                  .update({ logo_url: null })
                  .eq("id", establishmentId);
                setLogoUrl(null);
                onLogoUploaded?.("");
              }}
              className="text-xs text-red-500 hover:text-red-600 mt-1"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
