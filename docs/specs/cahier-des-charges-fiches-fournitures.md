# Cahier des Charges — Fiches de Renseignement & Fournitures

*Schooly SaaS / Trouvetou — 20/09/2026*

---

## 1. Contexte & Portée

Schooly offre un module de gestion des **fiches info** + **fournitures scolaires** :
- Wizard côté Direction (Schooly)
- Fiche publique côté Trouvetou (parent)
- PDF Mode A (classe) + Mode B (global + QR Code)
- **Zero-Image en BDD** (icônes Lucide + badges couleur)

**Périmètre** : Général/Technique/Pro, Primaire/Islamique/Supérieur, tarification tranchée, kits nationaux, duplication, export PDF.

## 2. Contraintes d'Architecture

**Stack** : Next 16 (App Router), Node 20, Supabase/PG 14.5, Tailwind v4, shadcn/ui + lucide, TurboRepo, Vitest/Playwright.

**Patterns** : Server Actions (`"use server"`), `useActionState`+`FormData`, double client Supabase (RLS / service_role), `touch_updated_at()` trigger, UUID PK.

**Conventions** : `@/` alias, `actions.ts` par module, `export type`, `sonner` toasts (schooly).

## 3. Schéma de Base de Données

### 3.1 Table `schools` — JSONB ajouté

#### `cycles_offered`
```jsonc
{
  "type": "lycee",
  "cycles": [
    {
      "key": "general", "label": "Enseignement Général",
      "series": ["A","C","D"],
      "levels": [{ "grade_level_name": "Seconde", "level": 4, "series": "A C D", "diploma": "Bac général", "requires_filiere_choice": true }]
    }
  ]
}
```

#### `fees_structure`
```jsonc
{
  "registration_fee": { "amount": 5000, "is_mandatory": true, "applies_to": "all", "status": "affecte" },
  "academic_fee": { "amount": 125000, "is_mandatory": true, "status": "affecte" },
  "installments": [{ "label": "Inscription", "position": 1, "amount": 5000, "due_date": "2024-09-01", "status": "affecte" }],
  "currency": "XOF", "multi_child_discount_rate": 0.10, "notes": "..."
}
```

#### `optional_services`
```jsonc
{
  "transport": { "enabled": true, "type": "zone", "vehicle_icon": "bus", "zones": [{"name": "Zone A", "price": 15000}] },
  "cantine": { "enabled": true, "type": "regime", "meal_icon": "utensils", "regimes": [{"name": "Standard", "price": 35000}] },
  "tenues": { "enabled": true, "type": "uniform", "badge_color": "blue", "items": [{"name": "Tenue de jour", "icon": "shirt"}] }
}
```

### 3.2 Table `school_supplies` (nouvelle)

```sql
create table if not exists public.school_supplies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_level_id uuid references public.grade_levels(id) on delete set null,
  class_name text not null,
  academic_year_id uuid not null references public.academic_years(id),
  configurations jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('published','draft')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, class_name, academic_year_id)
);
create index idx_school_supplies_school on public.school_supplies (school_id) where deleted_at is null;
create index idx_school_supplies_class on public.school_supplies (school_id, class_name) where deleted_at is null;
create index idx_school_supplies_gin on public.school_supplies using GIN (configurations);
```

#### JSONB `configurations` (extrait)
```jsonc
{
  "3eme": {
    "status": "published", "class_label": "3ᵉ", "level": 3, "cycle": "college", "series": "C", "year": "2024-2025",
    "manuals": [{ "subject": "Français", "title": "Lire et écrire - 3e", "editor": "Nathan", "icon": "book-open", "required_for_inscription": true }],
    "stationery": [{ "category": "Écriture", "name": "Classeur A4", "quantity": "1", "icon": "file-text" }],
    "equipment": [{ "name": "Rame de cahier", "quantity": "4", "required_for_inscription": true, "icon": "file-text" }]
  }
}
```


## 4. Arborescence des composants

### 4.1 Wizard Direction (`apps/schooly/src/app/dashboard/direction/informations/`)

```
dashboard/direction/informations/
├── page.tsx
├── wizard/
│   ├── WizardProvider.tsx
│   ├── WizardStepIndicator.tsx
│   ├── SchoolInfoForm.tsx
│   ├── AcademicOfferForm.tsx
│   ├── DossierForm.tsx
│   ├── PricingForm.tsx
│   └── WizardNavigation.tsx
├── supplies/
│   ├── ClassSelector.tsx
│   ├── KitPresetSelector.tsx
│   ├── SupplyEditor.tsx
│   ├── DuplicateToClassModal.tsx
│   ├── presets/index.ts
│   │   ├── general-3e.ts
│   │   ├── general-4e.ts
│   │   ├── general-2nde.ts
│   │   ├── pro-cap.ts
│   │   ├── pro-bt.ts
│   │   └── primaire-cp.ts
│   └── actions.ts
├── fiches/
│   ├── FicheList.tsx
│   ├── FichePreview.tsx
│   └── actions.ts
└── actions.ts
```

### 4.2 API Routes PDF (`apps/schooly/src/app/api/fiches/`)

```
app/api/fiches/
├── route.ts
├── mode-a/
│   └── route.ts
└── mode-b/
    └── route.ts
```

### 4.3 Portail Trouvetou (`apps/pwa-parent/src/app/fiche/[schoolId]/`)

```
app/fiche/[schoolId]/
├── page.tsx
├── SchoolHeader.tsx
├── AcademicOffer.tsx
├── FeesSection.tsx
├── OptionalServices.tsx
├── ClassSelector.tsx
├── SupplyList.tsx
└── DownloadModeA.tsx
```

### 4.4 Composants partagés (`apps/pwa-parent/src/components/fiches/`)

```
components/fiches/
├── SchoolLogo.tsx
├── BadgeCycle.tsx
├── BadgeSerie.tsx
├── BadgeStatus.tsx
├── ServiceIcon.tsx
├── KitPresetBadges.tsx
└── SupplyItem.tsx
```

## 5. Moteur de génération PDF

**Bibliothèques** :
- `@react-pdf/renderer` v4 (déjà installé)
- `qrcode` (serveur)

**Mode A** : client-side pwa-parent → `@react-pdf/renderer` + `pdf().toBlob()`
**Mode B** : server-side schooly API → `qrcode` + `@react-pdf/renderer` + `pdf().toBuffer()`

### PDF Mode A — Structure

```
┌─────────────────────────────────────────────────────┐
│ [Logo]  NOM DE L'ÉCOLE — VILLE                     │
│ FICHE DE FOURNITURES & TARIFICATION — 3e           │
├─────────────────────────────────────────────────────┤
│ 🏫 OFFRE : Enseignement Général · Série C          │
│ 💰 DROITS D'INSCRIPTION : 5 000 FCFA               │
│ 📅 ÉCHÉANCIER : Inscription 5 000 → 01/09/24       │
│ 📚 MANUELS : Français [...] [requis]               │
│ 📒 PAPIETERIE : Classeur A4 (1)                    │
│ 🎒 À L'INSCRIPTION : Rame (4) [requis]             │
│ 🚌 TRANSPORT : Zone A (15 000 FCFA/mois)           │
│ 🍽️ CANTINE : Standard (35 000 FCFA/mois)          │
│ 👕 TENUES : Tenue de jour                        │
├─────────────────────────────────────────────────────┤
│ Généré par Schooly • contact@ecole.ci              │
└─────────────────────────────────────────────────────┘
```

### PDF Mode B — Structure

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  NOM DE L'ÉCOLE                            │
│  GRILLE TARIFAIRE INSTITUTIONNELLE — 2024-2025     │
├─────────────────────────────────────────────────────┤
│ 📊 FRAIS D'INSCRIPTION : 5 000 FCFA                │
│ 6ème │ 125 000 │ ✅                                  │
│ 3ème │ 135 000 │ ✅                                  │
│ Services : 🚌 ≥15 000 │ 🍽️ ≥35 000 │ 👕 ≥8 500       │
│                                                     │
│  ┌──────────┐                                      │
│  │ [QR CODE] │ Scannez pour télécharger la        │
│  │          │ liste des fournitures de la classe  │
│  │ schooly  │ de votre enfant sur Trouvetou.       │
│  └──────────┘                                      │
│  https://trouvetou.schooly.ci/ecole/<schoolId>     │
├─────────────────────────────────────────────────────┤
│ contact@ecole.ci • Généré par Schooly              │
└─────────────────────────────────────────────────────┘
```

## 6. Sécurité & RLS

```sql
alter table public.school_supplies enable row level security;
create policy school_supplies_member_read on public.school_supplies for select
  using (is_super_admin() or is_school_member(school_id));
create policy school_supplies_write on public.school_supplies for all
  using (has_school_role(school_id, array['direction', 'super_admin']));
grant all on public.school_supplies to service_role;
```

Colonnes JSONB `schools` : héritent policies existantes (lecture tous membres, write direction).

**Zero-Image** : Logo = URL externe validée (`regex ^https?://` + `HEAD` request). Le reste = icônes Lucide.

## 7. Milestones

| M | Scope | Durée | Priorité |
|---|---|---|---|
| M1 | Schéma BDD & types | 1 jour | ⭐⭐⭐ |
| M2 | Wizard Direction | 3 jours | ⭐⭐⭐ |
| M3 | Fournitures & Kits | 2 jours | ⭐⭐⭐ |
| M4 | Portail Trouvetou | 2 jours | ⭐⭐⭐ |
| M5 | PDF Mode A | 1 jour | ⭐⭐⭐⭐ |
| M6 | PDF Mode B + QR | 2 jours | ⭐⭐⭐⭐ |
| M7 | Tests & Validation | 1 jour | ⭐⭐⭐ |

**Total** : 12 jours ouvrables.

## 8. Risques & Mitigations

| Risque | Mitigation |
|---|---|
| Performance JSONB | Index GIN, pagination classe |
| QR non scannable B/N | Contraste noir/blanc, ≥ 2cm |
| SVG complexe PDF | Icônes Lucide → paths |
| CORS logo externe | Proxy serveur + HEAD |

---
*Document préparé par l'Architecte Logiciel — équipe Schooly/Refontiq*
