import type { LucideIcon } from "lucide-react";

export type GeminiCardStatus = "positive" | "warning" | "neutral";

export interface GeminiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  status?: GeminiCardStatus;
  icon: LucideIcon;
  footer?: React.ReactNode;
}

const statusStyles: Record<
  GeminiCardStatus,
  { badge: string; iconWrap: string }
> = {
  positive: {
    badge: "bg-[#0f3d2e]/60 text-[#6ddba4]",
    iconWrap: "bg-[#0f3d2e]/50 text-[#6ddba4]",
  },
  warning: {
    badge: "bg-[#4a3213]/60 text-[#f2c98a]",
    iconWrap: "bg-[#4a3213]/50 text-[#f2c98a]",
  },
  neutral: {
    badge: "bg-hover text-accent-text",
    iconWrap: "bg-hover text-accent-primary",
  },
};

export default function GeminiCard({
  title,
  value,
  subtitle,
  badge,
  status = "neutral",
  icon: Icon,
  footer,
}: GeminiCardProps) {
  const s = statusStyles[status];
  return (
    <div className="group rounded-3xl bg-surface border border-subtle p-5 transition-all duration-200 hover:border-accent-primary/30 hover:bg-[#222324]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${s.iconWrap.split(" ")[0]}`}>
          <Icon className={`w-5 h-5 ${s.iconWrap.split(" ")[1]}`} />
        </div>
        {badge && (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.badge}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-[28px] leading-none font-semibold tracking-tight text-text tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] text-text">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
