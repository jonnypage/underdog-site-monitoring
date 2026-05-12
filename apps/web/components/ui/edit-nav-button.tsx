"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type EditNavButtonProps = {
  href: string;
  children?: ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
};

/**
 * Navigates to an edit URL with loading feedback — button disables and shows a
 * spinner while the Next.js transition (route + RSC payload) is in flight.
 */
export function EditNavButton({
  href,
  children = "Edit",
  variant = "ghost",
  size = "sm",
  className,
}: EditNavButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isPending}
      className={cn("gap-1.5", className)}
      aria-busy={isPending}
      aria-label={typeof children === "string" ? children : "Edit"}
      onMouseEnter={() => {
        router.prefetch(href);
      }}
      onClick={() => {
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      {isPending ? (
        <>
          <Spinner size="xs" className="text-current" />
          <span className="sr-only">Loading…</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
