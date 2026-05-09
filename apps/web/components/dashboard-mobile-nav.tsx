"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { OrgLogo } from "@/components/org-logo";
import { DashboardNavLinks } from "@/components/dashboard-nav-links";
import { Button } from "@/components/ui/button";

export function DashboardMobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 shrink-0 p-0"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50"
            aria-label="Close menu"
            onClick={close}
          />
          <div
            id={panelId}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw,16rem)] flex-col border-r border-border bg-background shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border p-4">
              <OrgLogo variant="sidebar" onNavigate={close} />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <DashboardNavLinks onNavigate={close} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
