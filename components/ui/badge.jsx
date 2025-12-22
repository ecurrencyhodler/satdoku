import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef(({ className, variant = "default", style, ...props }, ref) => {
  const variantStyles = {
    default: {
      border: '1px solid transparent',
      background: '#4299e1',
      color: 'white',
    },
    secondary: {
      border: '1px solid transparent',
      background: '#e2e8f0',
      color: '#4a5568',
    },
    destructive: {
      border: '1px solid transparent',
      background: '#e53e3e',
      color: 'white',
    },
    outline: {
      border: '1px solid #e2e8f0',
      background: 'transparent',
      color: 'inherit',
    },
  }

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    border: '1px solid',
    padding: '0.125rem 0.625rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    ...variantStyles[variant] || variantStyles.default,
    ...style
  }

  return (
    <div
      ref={ref}
      className={cn("badge-component", className)}
      style={baseStyle}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }

