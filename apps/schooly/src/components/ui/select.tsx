"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

function childText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(childText).join("")
  if (React.isValidElement(node)) {
    return childText((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

const SelectContext = React.createContext<{
  value: string
  label: string
  onValueChange: (value: string, label?: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}>({
  value: "",
  label: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
})

function Select({ value, onValueChange, children, disabled, name, required, id, defaultValue, displayLabel }: {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
  name?: string
  required?: boolean
  id?: string
  defaultValue?: string
  displayLabel?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [itemLabel, setItemLabel] = React.useState("")

  React.useEffect(() => {
    if (!value) setItemLabel("")
  }, [value])

  const handleChange = (next: string, label?: string) => {
    if (label) setItemLabel(label)
    onValueChange?.(next)
  }

  const currentValue = value || defaultValue || ""
  const label = displayLabel || itemLabel

  return (
    <SelectContext.Provider value={{ value: currentValue, label, onValueChange: handleChange, open, setOpen }}>
      <div className="relative">
        {children}
        {name && <input type="hidden" name={name} value={currentValue} readOnly required={required} id={id} disabled={disabled} />}
      </div>
    </SelectContext.Provider>
  )
}

function SelectTrigger({ children, className, disabled, id, ariaLabel }: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  id?: string
  ariaLabel?: string
}) {
  const ctx = React.useContext(SelectContext)
  
  return (
    <button
      type="button"
      id={id}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      disabled={disabled}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full",
        className
      )}
    >
      {children}
      <ChevronDown aria-hidden="true" className={cn("h-4 w-4 opacity-50 transition-transform", ctx.open && "rotate-180")} />
    </button>
  )
}

function SelectValue({ placeholder }: { placeholder: string }) {
  const ctx = React.useContext(SelectContext)
  const shown = ctx.label || ""
  return <span className={!shown ? "text-muted-foreground" : ""}>{shown || placeholder}</span>
}

function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext)
  
  if (!ctx.open) return null

  return (
    <div className={cn(
      "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      "w-full"
    )}>
      <div className={cn("max-h-96 overflow-auto p-1", className)}>
        {children}
      </div>
    </div>
  )
}

function SelectItem({ value, children, className }: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(SelectContext)
  
  return (
    <div
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-base outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        ctx.value === value && "bg-accent text-accent-foreground",
        className
      )}
      onClick={() => {
        ctx.onValueChange(value, childText(children))
        ctx.setOpen(false)
      }}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
