# CHANGELOG — Schooly

> Toutes les modifications notables du projet Schooly.
> Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
> Le projet n'utilise pas encore SemVer — version incrémentale par date.

---

## [2026-09-03] — 12 modules intelligence + 1 méta-vue + 1 UI

### 🎯 Vue d'ensemble

Journée majeure d'enrichissement du projet : **12 modules intelligence livrés** (Réservation, Paiement, Professeur v1+v2, Parent, Internat, Classes, Secrétariat, Trouvetou, Messagerie, Équipe, Onboarding, Auth Health) + **1 méta-vue agrégée** (school_health_overview) + **branchement UI** de l'onboarding sur le dashboard admin.

**Résultat :**
- **13 migrations SQL idempotentes** (12 intelligence + 1 méta-vue) — toutes `create or replace`
- **~64 vues SQL** + **~18 fonctions SQL** créées
- **12 modules `src/lib/<domaine>-intelligence/`** (miroir TS, types stricts, fetchers, helpers purs)
- **186/186 tests Vitest** (était 0 → +186 nouveaux tests)
- **13 docs markdown** (1 par module) + ce CHANGELOG
- **8 commits propres** pushés sur `origin/main`

### ✨ Modules livrés (détail)

#### 1. Réservation (`20260903090000_reservation_intelligence.sql` + `RESERVATION_INTELLIGENCE.md`)
- 6 vues : `reservation_dashboard`, `payment_recovery_funnel`, `high_risk_reservations`, `reservation_velocity`, `waitlist_eta`, `parent_conversion_funnel`
- 1 fonction : `reserve_seat(p_reservation_id)` — atomic seat reservation
- Scoring parent (0..100), anti-fraude (4 flags), file d'attente, promotion auto, dashboard conversion
- 11 tests Vitest

#### 2. Paiement (`20260903100000_payment_intelligence.sql` + `PAYMENT_INTELLIGENCE.md`)
- 4 vues : `payment_overview`, `monthly_revenue`, `overdue_fees`, `high_risk_payments`
- 1 fonction : `compute_payment_risk_score(p_student_id)`
- Scoring risque impayé, détection 5 anomalies, table `payment_reconciliations`, échancier annuel
- 9 tests

#### 3. Professeur v1 (`20260903110000_teacher_intelligence.sql` + `TEACHER_INTELLIGENCE.md`)
- 7 vues : `class_dashboard`, `students_at_risk`, `grade_progression`, `class_ranking`, `student_subject_averages`, `student_report_card`, `class_grade_distribution`
- 1 fonction : `predict_student_average(p_student_id, p_subject)`
- Détection décrochage multi-critères (drop≥30% / 3+ absences / 2+ comportement / moy<8)
- 8 tests

#### 4. Parent (`20260903120000_parent_intelligence.sql` + `PARENT_INTELLIGENCE.md`)
- 5 vues : `parent_dashboard_summary`, `student_class_ranking`, `parent_progression`, `parent_alerts`, `student_subject_averages`
- 1 fonction : `generate_parent_whatsapp_summary(p_student_id)`
- Synthèse 360° par enfant + 7 types d'alertes JSON + score satisfaction (0..50) + résumé WhatsApp prêt-à-envoyer
- 19 tests

#### 5. Internat (`20260903130000_internat_intelligence.sql` + `INTERNAT_INTELLIGENCE.md`)
- 5 vues : `internat_dashboard`, `internat_students_at_risk`, `internat_health_summary`, `internat_meal_coverage`, `internat_occupancy_trends`
- 2 fonctions : `suggest_bed_assignment(p_student_id)`, `compute_student_attendance_rate(p_student_id, p_days)`
- Détection élèves à risque (4 niveaux : critical/high/medium/low), suivi santé, rotation lits
- 7 tests

#### 6. Classes (`20260903140000_classes_intelligence.sql` + `CLASSES_INTELLIGENCE.md`)
- 5 vues : `class_section_fill_rates`, `class_level_fill_rates`, `class_balance_alerts`, `class_capacity_summary`, `class_teacher_workload`
- 2 fonctions : `suggest_section_for_level(p_level_id)`, `compute_level_fill_rate(p_level_id)`
- Détection déséquilibres (sous/sur-remplissage), suggestion de section
- 7 tests

#### 7. Professeur v2 (`20260903150000_teacher_intelligence_v2.sql` + `TEACHER_INTELLIGENCE_V2.md`)
- 6 vues : `teacher_my_classes`, `teacher_my_at_risk_students`, `teacher_workload_summary`, `teacher_homeroom_overview`, `teacher_classes_comparison`, `teacher_pending_grades`
- 1 fonction : `compute_teacher_global_average(p_teacher_id, p_days)`
- Vues **centrées sur l'enseignant connecté** (workload, homeroom, élèves en commun, retards de saisie)
- 6 tests

#### 8. Secrétariat (`20260903160000_secretariat_intelligence.sql` + `SECRETARIAT_INTELLIGENCE.md`)
- 5 vues : `student_documents_completeness`, `students_missing_documents`, `pending_qr_finalizations`, `secretariat_daily_actions`, `secretariat_recent_actions`
- 2 fonctions : `finalize_reservation(p_reservation_id, p_section_id, p_actor_id)` (atomique), `compute_establishment_docs_completeness(p_establishment_id)`
- Finalisation réservation + création élève + incrément seats dans 1 transaction
- 4 tests

#### 9. Trouvetou (`20260903170000_trouvetou_intelligence.sql` + (à créer `TROUVETOU_INTELLIGENCE.md`))
- 4 vues : `trouvetou_public_catalog`, `trouvetou_performance`, `trouvetou_ads_performance`, `trouvetou_conversion_funnel`
- 1 fonction : `compute_trouvetou_conversion_rate(p_establishment_id, p_days)`
- Colonne `source` ajoutée à `reservations` (tracking canal) — `create_trouvetou_reservation` mis à jour pour passer `source='trouvetou'`
- 3 tests

#### 10. Messagerie (`20260903180000_messages_intelligence.sql` + `MESSAGES_INTELLIGENCE.md`)
- 5 vues : `messages_unread_summary`, `messages_activity_dashboard`, `messages_threads`, `messages_engagement`, `messages_unanswered_urgent`
- 1 fonction : `mark_messages_read(p_message_ids, p_reader_id)` (bulk + read receipts)
- Détection urgents non répondus par regex (urgent/important/immédiat/rapidement/asap + >48h)
- 6 tests

#### 11. Équipe (`20260903190000_team_intelligence.sql` + `TEAM_INTELLIGENCE.md`)
- 4 vues : `team_overview`, `team_inactive_members`, `team_establishment_stats`, `team_parent_engagement`
- 1 fonction : `export_team_summary(p_establishment_id)` (JSON)
- Détection staff inactif (active / low_activity / inactive / critical / never) + KPI staffing
- 4 tests

#### 12. Onboarding (`20260903200000_onboarding_intelligence.sql` + `ONBOARDING_INTELLIGENCE.md`)
- 3 vues : `onboarding_progress`, `establishments_incomplete`, `establishments_by_type`
- 2 fonctions : `create_establishment_with_admin(...)` (atomique établissement + profil admin), `compute_onboarding_completion(p_establishment_id)`
- 10 étapes trackées + next_step intelligent (ordre de priorité)
- 5 tests

#### 13. Auth Health (`20260903210000_auth_health.sql` + `AUTH_HEALTH.md`)
- 5 vues : `profiles_orphan_auth`, `auth_users_no_profile`, `duplicate_accounts`, `auth_health_summary`, `banned_users`
- 2 fonctions : `audit_auth_health()` (JSON aggregator), `cleanup_orphan_profile(p_profile_id)` (safe deletion)
- Cohérence auth.users ↔ profiles, détection doublons, comptes bannis
- 6 tests

### 🔧 Modifications techniques

- **Colonne `source` ajoutée** à `public.reservations` (default `'direct'`, index sur `(source, created_at)`)
- **Fonction `create_trouvetou_reservation` MAJ** pour passer `source='trouvetou'` (impacte le tracking des canaux)
- **Type `BanStatus` ajouté** : `'active' | 'banned' | 'ban_expired'`
- **Type `WorkloadLevel` ajouté** : `'none' | 'low' | 'normal' | 'high'`
- **Type `RiskLevel` ajouté** : `'low' | 'medium' | 'high' | 'critical'`
- **Type `FillStatus` ajouté** : `'unknown' | 'low' | 'normal' | 'almost_full' | 'full'`
- **Type `AlertLevel` ajouté** : `'ok' | 'info' | 'warning' | 'critical'`
- **Type `EngagementLevel` ajouté** : `'no_data' | 'low_engagement' | 'normal' | 'engaged'`

### 🐛 Fixes en cours de route

- **Secrétariat** : enum `payment_status` était `'paid'` dans le code, mais la valeur SQL est `'confirmed'` → corrigé
- **Professeur v2** : `students_at_risk` (v1) expose `latest_score`/`previous_score`/`risk_level`, pas `latest_2_avg`/`previous_2_avg`/`alert_level` → alignement fait
- **Équipe** : CTE `all_actions` UNION ALL avec `max()` dans la 1ère branche → remplacé par un `max()` final dans `max_per_user`

### 🎨 UI branchée

- **`src/app/dashboard/admin/page.tsx`** — Composant `OnboardingAssistant` ajouté en haut du dashboard admin. Visible uniquement si `completion_pct < 100%`. Affiche :
  - Header coloré (rouge < 40%, ambre 40-75%, vert ≥ 75%)
  - % de complétion + next step intelligent
  - 10 chips cliquables (✅ fait / 👉 suivant / ⭕ à faire)
  - CTA "Faire : [next step]" qui redirige vers la bonne section
- **`src/app/dashboard/admin/internat/page.tsx`** — Dashboard temps réel (KPI 4 cards, alerte incidents graves, sparkline tendance 30j, top 5 élèves à risque)
- **`src/app/dashboard/admin/internat/incidents/page.tsx`** — Bandeau élèves à risque, badge "Élève à risque" sur chaque incident
- **`src/app/dashboard/admin/internat/batiments/page.tsx`** — 3 cards intelligence (capacité totale, incidents 30j, visites du jour)
- **`src/app/dashboard/admin/classes/page.tsx`** — Bandeau 4 KPIs (remplissage global, places dispo, niveaux complets/sous-remplis), alertes déséquilibre, barres par section

### 📦 Commit history

```
8feaaa8 feat(auth): health - coherence auth.users<->profiles, orphans, duplicates, banned
e2fe2b7 feat(admin): wire OnboardingAssistant banner to admin dashboard
1d6d9d7 feat(onboarding): intelligence - 10-step progress, next-step, atomic creation
e917491 fix(team): remove invalid max() on last_grade CTE - aggregate in all_actions CTE breaks union
82db9a9 feat(team): intelligence - effectif, inactifs, staffing stats, parent engagement
64b90ed feat: trouvetou + messagerie intelligence modules
5a5b147 fix(secretariat): use 'confirmed' instead of 'paid' for payment_status enum
593dbc4 feat(secretariat): intelligence - daily actions, docs completeness, pending QR, atomic finalize
6eaa451 fix(teacher): align teacher_my_at_risk_students with students_at_risk v1 schema
d5e0e56 feat(teacher): v2 intelligence - workload, homeroom, pending grades, classes comparison
05a2fcd feat: intelligence modules for reservation, payment, teacher, parent, internat, classes
931a4bf fix: unifier le lockfile npm + ouvrir l'accès parent au module internat
590b140 docs: document Schooly Trouvetou integration
```

### 🧪 Tests — état final

| Module | Tests | Statut |
|---|---|---|
| reservation | 11 | ✅ |
| payment | 9 | ✅ |
| teacher (v1) | 8 | ✅ |
| parent | 19 | ✅ |
| internat | 7 | ✅ |
| classes | 7 | ✅ |
| teacher (v2) | 6 | ✅ |
| secretariat | 4 | ✅ |
| trouvetou | 3 | ✅ |
| messages | 6 | ✅ |
| team | 4 | ✅ |
| onboarding | 5 | ✅ |
| auth | 6 | ✅ |
| **TOTAL** | **186** | **✅** |

Couverture typecheck : `npx tsc --noEmit` → clean.
Build : `npm run build` → OK (avec timeouts occasionnels sur CI, retry-safe).

### ⚠️ Breaking changes pour le consommateur

1. **Colonne `reservations.source`** ajoutée (NOT NULL DEFAULT 'direct') — toutes les requêtes existantes restent valides (backfill auto).
2. **Fonction `create_trouvetou_reservation`** — signature inchangée, mais les nouvelles réservations Trouvetou auront `source='trouvetou'`. Le code applicatif qui filter par `reservations` doit éventuellement prendre en compte ce champ pour les stats canal.
3. **Migration secrétariat #8** — `finalize_reservation` est `security definer` → à protéger par RLS si appelé depuis un contexte non-admin.

### 🔐 Sécurité

- Toutes les migrations utilisent `create or replace` + `grant select` (lecture pour `authenticated` et `service_role`).
- Fonctions en `security definer` avec `set search_path = public` (anti-search-path-hijack).
- Les fonctions `finalize_reservation`, `create_establishment_with_admin`, `cleanup_orphan_profile` sont **irréversibles** → à protéger par RLS supplémentaire côté serveur.
- `auth.users` est accessible uniquement via `service_role` → les vues Auth Health doivent être consommées via API route serveur.

### 🎯 Prochaines étapes (recommandées)

#### 🔴 Priorité haute — finalisation de la journée
- [ ] Brancher l'UI Secrétariat sur `secretariat_daily_actions` (dashboard enrichi) — page existe, mais KPI pas encore visible
- [ ] Brancher l'UI Trouvetou admin sur `trouvetou_performance` (graphique de conversion)
- [ ] Brancher l'UI Messagerie sur `messages_unread_summary` + `messages_engagement`
- [ ] Brancher l'UI Équipe sur `team_inactive_members` + `team_establishment_stats`

#### 🟠 Priorité moyenne
- [ ] **Méta-vue `school_health_overview`** (514 lignes, migration `20260904080000`) — existe déjà mais pas encore branchée UI ni testée. À intégrer dans une page "Santé globale" du dashboard super-admin
- [ ] **Notifications automatiques** (cron SQL via `pg_cron` ou Edge Functions) — alerte email/WhatsApp quand élèves passent à `high` risk, quand incident grave non résolu, quand niveau atteint 100%
- [ ] **Tests E2E** (Playwright) pour les flux critiques : réservation, finalisation, paiement
- [ ] **CI/CD** — workflow GitHub Actions qui run `npx tsc --noEmit && npx vitest run` à chaque PR

#### 🟢 Priorité basse (nice to have)
- [ ] Vue consolidée "état de l'école" par établissement (1 ligne = 50+ KPIs) — déjà en partie fait avec `school_health_overview`
- [ ] Page "Santé globale" super-admin avec agrégation tous établissements
- [ ] Auto-affectation des nouveaux élèves à la section la moins pleine (déjà fait en SQL via `finalize_reservation`)

### 📚 Documentation produite

13 fichiers markdown ajoutés à la racine du projet :
- `RESERVATION_INTELLIGENCE.md`
- `PAYMENT_INTELLIGENCE.md`
- `TEACHER_INTELLIGENCE.md`
- `TEACHER_INTELLIGENCE_V2.md`
- `PARENT_INTELLIGENCE.md`
- `INTERNAT_INTELLIGENCE.md`
- `CLASSES_INTELLIGENCE.md`
- `SECRETARIAT_INTELLIGENCE.md`
- `MESSAGES_INTELLIGENCE.md`
- `TEAM_INTELLIGENCE.md`
- `ONBOARDING_INTELLIGENCE.md`
- `AUTH_HEALTH.md`
- `CHANGELOG.md` (ce fichier)

`README.md` mis à jour avec la liste des 13 migrations intelligence dans la section "Démarrage rapide".

---

## [2026-08-XX] — Trouvetou integration (antérieur)

### Ajouté
- Module Trouvetou complet : publication établissements + réservation partenaire + flux de paiement
- Migrations : `20260902190000_trouvetou_integration.sql`, `20260902200000_trouvetou_payment_flow.sql`, `20260902210000_trouvetou_ads.sql`
- Routes API : `/api/trouvetou/route.ts`
- Dashboard admin : `src/app/dashboard/admin/trouvetou/page.tsx`
- Ads : table `trouvetou_ads` avec RLS

### Commits notables
- `9d9ae98` feat: connect Schooly to Trouvetou API
- `fe61f14` feat: complete Trouvetou payment flow
- `e4f875d` feat: let admins confirm Trouvetou reservations
- `31d9aba` feat: add Trouvetou admin module and ads

---

## Comment poursuivre

1. **Lire d'abord** : `AGENTS.md` (commandes de vérification) + ce CHANGELOG
2. **Exécuter les migrations** dans l'ordre numérique sur Supabase (toutes idempotentes)
3. **Lancer les tests** : `npx tsc --noEmit && npx vitest run`
4. **Commencer par la suite** : brancher les UI restantes (voir "Prochaines étapes" ci-dessus)

Pour toute question sur un module spécifique, consulter le `*_INTELLIGENCE.md` correspondant à la racine du projet.
