"use client"

import { useActionState, useState } from "react"

type FormState = { error?: string }
export type ActionFormData = unknown

type Props = {
  action: (formData: FormData) => Promise<{ error?: string; data?: ActionFormData } | void>
  children: React.ReactNode
  className?: string
  onSuccess?: (data?: ActionFormData) => void
  onError?: (error: string) => void
}

export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  onError,
}: Props) {
  const [state, setState] = useState<FormState>({})

  async function handleSubmit(formData: FormData) {
    const result = (await action(formData)) || {}
    if (result.error) {
      setState({ error: result.error })
      onError?.(result.error)
    } else {
      setState({})
      onSuccess?.(result.data)
    }
  }

  return (
    <form action={handleSubmit} className={className}>
      {children}
      {state.error && (
        <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-sm font-medium">
          {state.error}
        </div>
      )}
    </form>
  )
}
