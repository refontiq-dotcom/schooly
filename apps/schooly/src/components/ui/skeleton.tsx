import { cn } from "@/lib/utils"

/** Bloc de squelette animé (shadcn) — remplacé dès que les données arrivent. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}
