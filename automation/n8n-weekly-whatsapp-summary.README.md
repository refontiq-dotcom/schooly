# Workflow n8n — Récapitulatif hebdomadaire WhatsApp (Phase 2)

Ce dossier documente le workflow à construire dans n8n pour l'envoi automatique,
chaque fin de semaine, d'un récapitulatif de présence et de notes à chaque parent.

## Déclenchement
- **Cron Trigger** : chaque vendredi à 17h00 (heure d'Abidjan).

## Étapes du workflow

1. **Supabase — Get Many Rows** : récupérer tous les élèves (`students`) actifs.
2. **Supabase — Get Many Rows** : pour chaque élève, récupérer :
   - les `attendance_records` de la semaine (lundi → vendredi)
   - les `grades` de la semaine
3. **Function Node** : construire le message texte, ex.
   ```
   Bonjour {parent_full_name}, voici le suivi de {student_full_name} cette semaine :
   - Présence : 4/5 jours
   - Notes : Mathématiques 14/20, Français 16/20
   Cordialement, {establishment_name}
   ```
4. **HTTP Request — WhatsApp Business API** :
   - `POST https://graph.facebook.com/v20.0/{phone_number_id}/messages`
   - Headers : `Authorization: Bearer {{$env.WHATSAPP_API_TOKEN}}`
   - Body : template WhatsApp approuvé ou message texte simple selon la fenêtre
     de conversation (24h) autorisée par Meta.
5. **Supabase — Update Row** (optionnel) : marquer l'envoi comme effectué pour
   éviter les doublons en cas de re-exécution.

## Variables d'environnement nécessaires
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`

## Note
Ce fichier est un guide de construction, pas un export n8n prêt à l'emploi — le
workflow doit être construit dans l'interface n8n en s'appuyant sur les nœuds
Supabase et HTTP Request déjà utilisés sur les autres projets Refontiq
(agent WhatsApp/Telegram boutiques).
