import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-component", className)}
    style={{
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      background: '#f7fafc',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      transition: 'background-color 0.2s, border-color 0.2s',
      ...style
    }}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-header", className)}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      padding: '1.5rem',
      ...style
    }}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, style, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("card-title", className)}
    style={{
      fontSize: '1.5rem',
      fontWeight: '600',
      lineHeight: '1.2',
      letterSpacing: '-0.025em',
      margin: 0,
      color: '#2d3748',
      transition: 'color 0.2s',
      ...style
    }}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("card-description", className)}
    style={{
      fontSize: '0.875rem',
      color: '#718096',
      margin: 0,
      transition: 'color 0.2s',
      ...style
    }}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-content", className)}
    style={{
      padding: '0 1.5rem 1.5rem 1.5rem',
      ...style
    }}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-footer", className)}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.5rem 1.5rem 1.5rem',
      ...style
    }}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

const CardAction = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-action", className)}
    style={{
      marginLeft: 'auto',
      ...style
    }}
    {...props}
  />
))
CardAction.displayName = "CardAction"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardAction }
