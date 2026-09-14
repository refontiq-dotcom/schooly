"use client"

import { useActionState, useState } from "react"

type FormState = { error?: string }

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<{ error?: string; data?: any } | void>
  children: React.ReactNode
  className?: string
}) {
  const [state, setState] = useState<FormState>({})

  async function handleSubmit(formData: FormData) {
    const result = (await action(formData)) || {}
    if (result.error) {
      setState({ error: result.error })
    } else {
      setState({})
    }
  }

  return (
    <form action={handleSubmit} className={className}>
      {children}
      {state.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          {state.error}
        </div>
      )}
    </form>
  )
}
