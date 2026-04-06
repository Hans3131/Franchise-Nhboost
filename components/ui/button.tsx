"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-[#4a81a4] focus-visible:ring-3 focus-visible:ring-[rgba(74,129,164,0.2)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[#2d2d60] text-white shadow-[0_1px_3px_rgba(45,45,96,0.25)] hover:bg-[#4a81a4] hover:shadow-[0_2px_8px_rgba(74,129,164,0.35)] active:bg-[#2d2d60]",
        outline:
          "border-[#D1D9E8] bg-white text-[#2d2d60] hover:bg-[#F5F7FA] hover:border-[#4a81a4] hover:text-[#4a81a4] aria-expanded:bg-[#F5F7FA]",
        secondary:
          "bg-[#EFF3F9] text-[#2d2d60] hover:bg-[#E2E8F2] aria-expanded:bg-[#EFF3F9]",
        ghost:
          "text-[#6B7280] hover:bg-[#EFF3F9] hover:text-[#2d2d60] aria-expanded:bg-[#EFF3F9]",
        destructive:
          "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 focus-visible:border-red-400 focus-visible:ring-red-200/50",
        link: "text-[#4a81a4] underline-offset-4 hover:underline hover:text-[#2d2d60]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
