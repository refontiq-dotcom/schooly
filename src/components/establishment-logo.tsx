"use client";

import Image from "next/image";

interface EstablishmentLogoProps {
  logoUrl: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { container: "w-8 h-8", text: "text-xs" },
  md: { container: "w-10 h-10", text: "text-sm" },
  lg: { container: "w-16 h-16", text: "text-lg" },
};

export default function EstablishmentLogo({
  logoUrl,
  name,
  size = "md",
  className = "",
}: EstablishmentLogoProps) {
  const s = SIZE_MAP[size];

  if (logoUrl) {
    return (
      <div className={`${s.container} rounded-xl overflow-hidden shrink-0 ${className}`}>
        <Image
          src={logoUrl}
          alt={name}
          width={64}
          height={64}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.container} rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold ${s.text} shrink-0 shadow-md shadow-blue-500/20 ${className}`}
    >
      {name?.charAt(0) ?? "S"}
    </div>
  );
}
