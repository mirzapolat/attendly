import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 backdrop-blur-md border border-border/40 bg-background/30 shadow-sm hover:shadow-md transform-gpu hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary/90 text-primary-foreground border-primary/30 hover:bg-primary/80",
        destructive: "bg-destructive/90 text-destructive-foreground border-destructive/30 hover:bg-destructive/80",
        outline: "border-input/70 bg-background/50 hover:bg-background/70 hover:text-foreground hover:border-border/80",
        secondary: "bg-secondary/80 text-secondary-foreground border-secondary/40 hover:bg-secondary/70",
        ghost: "bg-transparent border-transparent shadow-none hover:bg-background/40 hover:text-secondary-foreground",
        link: "bg-transparent border-transparent shadow-none text-primary underline-offset-4 hover:underline",
        hero: "bg-primary/90 text-primary-foreground border-primary/40 hover:bg-primary/80 hover:scale-[1.02] transition-all duration-300",
        warning: "bg-warning/90 text-warning-foreground border-warning/30 hover:bg-warning/80",
        glass:
          "border-border/60 bg-background/60 text-foreground hover:bg-background/80 hover:border-border/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
