import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-800 text-zinc-200",
        secondary:
          "bg-zinc-900 text-zinc-400",
        outline:
          "bg-transparent text-zinc-300",
        subtle:
          "bg-zinc-800/60 text-zinc-400",
        accent:
          "bg-zinc-100 text-zinc-900 font-semibold",
        info:
          "bg-zinc-800 text-zinc-200",
        warning:
          "bg-amber-950/40 text-amber-300",
        destructive:
          "bg-red-950/40 text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
