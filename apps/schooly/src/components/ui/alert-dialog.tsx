"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const AlertDialog = ({ open, onOpenChange, children }: AlertDialogProps) => {
  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 z-0 animate-in fade-in duration-200 bg-[#0e2d52]/55 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 flex w-full max-w-lg min-h-0 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-card p-5 sm:p-6 shadow-[0_24px_70px_oklch(0.2_0.05_252_/_0.25)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {children}
      </div>
    </div>
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
  <h2 className={cn("text-lg font-semibold", className)} {...props} />
);

export const AlertDialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export const AlertDialogAction = ({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="destructive" className={cn("", className)} onClick={onClick} {...props} />
);

export const AlertDialogCancel = ({ className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <Button variant="outline" className={cn("", className)} onClick={onClick} {...props} />
);
