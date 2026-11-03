import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Furrow moulded keys: 6px corners, a lit top edge, sinks 1px when pressed.
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-key border text-sm font-medium transition-[background-color,border-color,transform] duration-micro ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 aria-busy:cursor-progress motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 after:absolute after:-inset-1 after:content-[""]',
  {
    variants: {
      variant: {
        default:
          'border-action-edge bg-action text-action-ink shadow-key-primary hover:bg-action/90',
        destructive:
          'border-danger bg-danger text-destructive-foreground shadow-key-primary hover:bg-danger/90',
        outline: 'border-rule bg-paper-2 text-ink shadow-key hover:bg-paper-3',
        secondary: 'border-rule bg-paper-3 text-ink shadow-key hover:bg-paper-3/80',
        ghost: 'border-transparent text-ink hover:bg-paper-3',
        link: 'border-transparent text-ink underline underline-offset-4 decoration-rule hover:decoration-ink'
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3',
        lg: 'h-10 px-5',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
