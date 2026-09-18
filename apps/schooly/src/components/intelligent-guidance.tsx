"use client"

import { ArrowRight, BrainCircuit, CircleAlert, Lightbulb, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { GuidanceItem } from "@/lib/guidance"

export function IntelligentGuidance({ items, title = "Schooly vous guide" }: { items: GuidanceItem[]; title?: string }) {
  const next = items.find(item => item.severity === "critical") ?? items.find(item => item.severity === "action") ?? items.find(item => item.severity === "warning") ?? items[0]
  if (!next) return null
  const Icon = next.severity === "critical" ? ShieldAlert : next.severity === "warning" ? Lightbulb : CircleAlert
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-primary" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{next.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
              {next.actionLabel && next.href && <Button asChild size="sm" className="mt-3"><Link href={next.href}>{next.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}{next.actionLabel && !next.href && next.onAction && <Button size="sm" className="mt-3" onClick={next.onAction}>{next.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
