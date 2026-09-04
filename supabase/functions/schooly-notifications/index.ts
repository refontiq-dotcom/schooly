import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    db: { schema: 'public' },
    auth: { persistSession: false },
  }
)

interface PendingNotification {
  id: string
  establishment_id: string
  alert_type: string
  channel: string
  recipient_id: string | null
  recipient_phone: string | null
  recipient_email: string | null
  subject: string
  body: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Senders (stub — branchez vos propres providers d'email / WhatsApp ici)
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string | null,
  subject: string,
  body: string,
): Promise<boolean> {
  if (!to) return false
  // Exemple SendGrid via API HTTP — à adapter à votre provider.
  const apiKey = Deno.env.get('SENDGRID_API_KEY')
  if (!apiKey) return false
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: Deno.env.get('EMAIL_FROM') ?? 'no-reply@schooly.local' },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function sendWhatsApp(
  to: string | null,
  body: string,
): Promise<boolean> {
  if (!to) return false
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
  if (!accountSid || !authToken || !from) return false
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:${to.replace(/\D/g, '')}`,
        Body: body,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Orchestrateur principal
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Sécurité : autoriser uniquement un cron secret ou un appel depuis pg_cron.
  const cronSecret = Deno.env.get('SCHOOLY_CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret')
    if (provided !== cronSecret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const url = new URL(req.url)
  const establishmentId = url.searchParams.get('establishment_id') ?? undefined

  // 1) Déclenche la détection d'alertes en base → crée des notifications en attente
  const { data: dispatch, error: dispatchError } = await supabase.rpc(
    'dispatch_schooly_notifications',
    establishmentId ? { p_establishment_id: establishmentId } : {},
  )

  if (dispatchError) {
    console.error('[schooly-notifications] dispatch error', dispatchError)
    return new Response(
      JSON.stringify({ error: dispatchError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // 2) Récupère les notifications en attente (max 100 par lot)
  const { data: pendings, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)

  if (fetchError) {
    console.error('[schooly-notifications] fetch pending error', fetchError)
    return new Response(
      JSON.stringify({ dispatched: dispatch, error: fetchError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let sent = 0
  let failed = 0

  for (const n of (pendings ?? []) as PendingNotification[]) {
    let ok = false
    if (n.channel === 'email') {
      ok = await sendEmail(n.recipient_email, n.subject, n.body)
    } else if (n.channel === 'whatsapp') {
      ok = await sendWhatsApp(n.recipient_phone, n.body)
    } else if (n.channel === 'in_app') {
      // in-app : la notification reste en base, on la marque comme lue côté UI
      ok = true
    }

    if (ok) {
      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', n.id)
      sent++
    } else {
      await supabase
        .from('notifications')
        .update({ status: 'failed', error: 'Provider non configuré' })
        .eq('id', n.id)
      failed++
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dispatch,
      pending_processed: pendings?.length ?? 0,
      sent,
      failed,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
