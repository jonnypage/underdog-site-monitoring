"use client";

import { useId, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` styles the confirm action as dangerous (e.g. delete). */
  confirmTone?: "default" | "destructive";
  pending?: boolean;
  /** Shown on the confirm button while `pending` is true (e.g. `Deleting…`). */
  pendingLabel?: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "default",
  pending = false,
  pendingLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();

  if (!open) return null;

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (pending) return;
    if (event.target === event.currentTarget) onOpenChange(false);
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/50 p-4 fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md animate-in rounded-lg border border-border bg-background p-6 shadow-xl duration-200 zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={pending}
            className={cn(
              "gap-2",
              confirmTone === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:opacity-90",
            )}
            onClick={onConfirm}
          >
            {pending ? (
              <>
                <Spinner
                  className={confirmTone === "destructive" ? "text-destructive-foreground" : "text-primary-foreground"}
                  size="md"
                />
                {pendingLabel ?? `${confirmLabel}…`}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
