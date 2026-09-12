import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 text-zinc-900 shadow-sm hover:bg-zinc-200 active:scale-[0.98]",
        secondary:
          "bg-zinc-800/90 text-zinc-100 hover:bg-zinc-800 active:scale-[0.98]",
        outline:
          "bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50 active:scale-[0.98]",
        ghost:
          "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100",
        destructive:
          "bg-red-950/60 text-red-300 hover:bg-red-900/70 hover:text-red-100",
        subtle:
          "bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200",
      },
      size: {
        default: "h-9 px-3.5 py-2 text-sm",
        sm: "h-7 rounded-md px-2.5 text-xs font-medium",
        lg: "h-10 rounded-md px-5 text-sm",
        icon: "h-7 w-7 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
