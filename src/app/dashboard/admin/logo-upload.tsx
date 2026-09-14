"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface LogoUploadProps {
  establishmentId: string;
  currentLogoUrl: string | null;
  establishmentName: string;
  onUploaded?: (url: string) => void;
}

export default function LogoUpload({
  establishmentId,
  currentLogoUrl,
  establishmentName,
  onUploaded,
}: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 2 Mo.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${establishmentId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("establishment-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("establishment-logos").getPublicUrl(path);

      // Update establishment
      const { error: dbError } = await supabase
        .from("establishments")
        .update({ logo_url: publicUrl })
        .eq("id", establishmentId);

      if (dbError) throw dbError;

      setPreview(publicUrl);
      onUploaded?.(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700 block">
        Logo de l&apos;établissement
      </label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative group"
          disabled={uploading}
        >
          {preview ? (
            <img
              src={preview}
              alt="Logo"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 group-hover:border-blue-400 transition-colors"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 group-hover:border-blue-400 flex items-center justify-center transition-colors">
              <span className="text-2xl">🏫</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </button>
        <div className="text-xs text-slate-400">
          <p>Cliquez pour changer le logo</p>
          <p>PNG, JPG — max 2 Mo</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
