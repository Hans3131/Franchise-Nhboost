import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-[#D1D9E8] bg-white px-3 py-1.5 text-sm text-[#2d2d60] transition-all outline-none placeholder:text-[#9CA3AF] focus-visible:border-[#4a81a4] focus-visible:ring-3 focus-visible:ring-[rgba(74,129,164,0.15)] hover:border-[#B0BDD6] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F5F7FA] disabled:opacity-60 aria-invalid:border-red-400 aria-invalid:ring-3 aria-invalid:ring-red-200/50 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#2d2d60]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
