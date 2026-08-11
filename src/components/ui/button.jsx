import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(211,100%,50%)] text-white shadow-sm shadow-[hsl(211,100%,50%)]/20 hover:bg-[hsl(211,100%,45%)] hover:shadow-md hover:shadow-[hsl(211,100%,50%)]/25",
        destructive:
          "bg-[hsl(0,72%,51%)] text-white shadow-sm hover:bg-[hsl(0,72%,46%)]",
        outline:
          "border border-[hsl(220,13%,89%)] bg-white/80 shadow-sm hover:bg-[hsl(220,14%,96%)] hover:border-[hsl(220,13%,85%)] text-[hsl(220,13%,18%)]",
        secondary:
          "bg-[hsl(220,14%,96%)] text-[hsl(220,13%,18%)] hover:bg-[hsl(220,14%,93%)]",
        ghost: "hover:bg-[hsl(220,14%,96%)] text-[hsl(220,9%,46%)] hover:text-[hsl(220,13%,18%)]",
        link: "text-[hsl(211,100%,50%)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
