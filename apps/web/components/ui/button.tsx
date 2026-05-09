import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
};

export function Button({ asChild, className, variant = "default", size = "default", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "outline" && "border border-border bg-background hover:bg-muted",
        variant === "ghost" && "hover:bg-muted",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 px-3",
        className
      )}
      {...props}
    />
  );
}
