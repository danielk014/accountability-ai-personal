import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[hsl(211,100%,50%)] text-white shadow-sm shadow-[hsl(211,100%,50%)]/15",
        secondary:
          "border-transparent bg-[hsl(220,14%,96%)] text-[hsl(220,13%,18%)]",
        destructive:
          "border-transparent bg-[hsl(0,72%,51%)] text-white shadow-sm",
        outline: "text-[hsl(220,13%,18%)] border-[hsl(220,13%,89%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
