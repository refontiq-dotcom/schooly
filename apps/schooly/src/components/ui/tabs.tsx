"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({
  value: "",
  onValueChange: () => {},
})

function Tabs({ value, defaultValue, onValueChange, children, className }: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue
  const handleChange = (v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex h-12 items-center justify-center rounded-xl border border-border/70 bg-muted/70 p-1 text-foreground/80 shadow-sm", className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className }: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx.value === value
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "relative isolate inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-base font-medium ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive ? "text-foreground" : "hover:text-foreground",
        className
      )}
    >
      {isActive && <motion.span layoutId="schooly-tab-indicator" aria-hidden="true" className="absolute inset-0 -z-10 rounded-lg bg-card shadow-[0_4px_12px_oklch(0.25_0.05_252_/_0.12)]" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 32, mass: .65 }} />}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

function TabsContent({ value, children, className }: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null

  return <div className={cn("mt-2", className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
