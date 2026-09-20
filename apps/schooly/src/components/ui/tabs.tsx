"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
  indicatorId: string
}>({
  value: "",
  onValueChange: () => {},
  indicatorId: "schooly-tabs-indicator",
})

function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}) {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue
  const indicatorId = React.useId()

  const handleChange = (v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange, indicatorId }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex h-12 w-full max-w-full items-center overflow-x-auto rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-1 text-[#5f7899] shadow-[0_2px_10px_rgba(37,99,235,0.06)]",
        "scrollbar-none",
        className,
      )}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  children,
  className,
}: {
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
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "relative isolate flex min-w-max flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium",
        "text-[#5f7899] transition-colors duration-200 hover:text-[#2563eb]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        !isActive && "after:absolute after:right-0 after:top-1/2 after:h-5 after:w-px after:-translate-y-1/2 after:bg-[#cbdcf2]",
        isActive && "text-white",
        className,
      )}
    >
      {isActive && (
        <motion.span
          layoutId={ctx.indicatorId}
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-xl bg-[#2563eb] shadow-[0_4px_12px_rgba(37,99,235,0.24)]"
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 460, damping: 32, mass: 0.65 }
          }
        />
      )}
      <span className="relative z-10 inline-flex items-center">{children}</span>
    </button>
  )
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null

  return <div className={cn("mt-2", className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
