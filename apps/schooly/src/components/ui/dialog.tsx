"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

const DialogTitleIdContext = React.createContext<string | undefined>(undefined);
const DialogDescIdContext = React.createContext<string | undefined>(undefined);

export const Dialog = ({ open, onOpenChange, children, className, label }: DialogProps) => {
  const titleId = React.useId();
  const descId = React.useId();

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
        className="fixed inset-0 animate-in fade-in duration-200 bg-[#0e2d52]/55 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={label ? undefined : titleId}
        aria-describedby={descId}
        aria-label={label}
        className={cn(
          "relative z-10 flex w-full max-w-lg min-h-0 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-card p-5 sm:p-6 shadow-[0_24px_70px_oklch(0.2_0.05_252_/_0.25)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200",
          className
        )}
      >
        <DialogTitleIdContext.Provider value={titleId}>
          <DialogDescIdContext.Provider value={descId}>
            {children}
          </DialogDescIdContext.Provider>
        </DialogTitleIdContext.Provider>
      </div>
    </div>
  );
};

export const DialogTrigger = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button onClick={onClick} type="button">{children}</button>
);

export const DialogContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("", className)} {...props}>{children}</div>
);

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

export const DialogTitle = ({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  const ctxId = React.useContext(DialogTitleIdContext);
  return (
    <h2 id={id ?? ctxId} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  );
};

export const DialogDescription = ({ className, id, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
  const ctxId = React.useContext(DialogDescIdContext);
  return (
    <p id={id ?? ctxId} className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
};

export const DialogClose = ({ onClick, children, label = "Fermer" }: { onClick: () => void; children?: React.ReactNode; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="absolute right-4 top-4 z-20 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
  >
    {children || <span aria-hidden="true">✕</span>}
  </button>
);

export const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DialogOverlay = ({ children }: { children: React.ReactNode }) => <>{children}</>;
