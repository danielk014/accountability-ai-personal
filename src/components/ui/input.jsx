import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[hsl(220,13%,89%)] bg-white/80 px-4 py-2.5 text-base text-[hsl(220,13%,10%)] shadow-sm shadow-black/[0.03] transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[hsl(220,9%,55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211,100%,50%)]/20 focus-visible:border-[hsl(211,100%,50%)] disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
