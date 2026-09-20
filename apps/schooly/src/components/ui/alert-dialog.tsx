"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 animate-in fade-in duration-200 bg-[#0e2d52]/55 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative z-[101] w-full max-w-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 rounded-2xl border border-white/70 bg-card p-6 shadow-[0_24px_70px_oklch(0.2_0.05_252_/_0.25)]">
        {children}
      </div>
    </div>,
    document.body
  );
};

export const AlertDialogTrigger = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} type="button">{children}</button>
);

export const AlertDialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const AlertDialogOverlay = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const AlertDialogContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("", className)} {...props}>{children}</div>
);

export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

export const AlertDialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-xl font-semibold leading-snug text-foreground", className)} {...props} />
);

export const AlertDialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-base leading-relaxed text-muted-foreground", className)} {...props} />
);

export const AlertDialogAction = ({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="destructive" className={cn("", className)} onClick={onClick} {...props} />
);

export const AlertDialogCancel = ({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="outline" className={cn("", className)} onClick={onClick} {...props} />
);
