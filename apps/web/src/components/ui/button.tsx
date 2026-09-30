import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-xs uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "border border-cyan/60 bg-cyan/10 text-cyan hover:bg-cyan/20 hover:shadow-glow",
        solid: "border border-cyan bg-cyan text-bg hover:bg-cyan/90",
        ghost: "border border-transparent text-muted hover:border-line hover:bg-elevated hover:text-ink",
        outline: "border border-line bg-panel text-ink/90 hover:border-line-strong hover:bg-elevated",
        danger: "border border-red/60 bg-red/10 text-red hover:bg-red/20",
        success: "border border-green/60 bg-green/10 text-green hover:bg-green/20",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-9 px-3.5",
        lg: "h-11 px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
