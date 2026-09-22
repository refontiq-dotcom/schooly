// ============================================================================
// lib/fiches/normalize.ts — Lecture défensive des JSONB du module Fiches.
//
// POURQUOI : `schools.cycles_offered` / `fees_structure` / `optional_services`
// et `school_supplies.configurations` sont des colonnes JSONB remplies par des
// Server Actions, donc par des données non fiables côté lecture (saisie
// partielle d'un wizard, école onboardée avant l'ajout d'un champ, JSONB
// importé). Un JSONB vide `{}` est la valeur par défaut des colonnes : le code
// appelant NE DOIT PAS avoir à se protéger de `undefined` sur chaque champ.
//
// Ces normaliseurs garantissent la forme : ils ne jettent jamais, ils
// complètent avec des valeurs neutres. Les règles « dures » (montant négatif,
// quantité vide) sont neutralisées silencieusement — même philosophie que
// lib/discounts.ts : une école ne doit jamais voir un écran planté à cause
// d'une donnée incomplète.
//
// Toutes les fonctions sont PURES : aucun accès réseau, aucune date implicite.
// ============================================================================

import {
  CYCLE_LABELS,
  DEFAULT_CURRENCY,
  EDUCATION_CYCLES,
  SCHOOL_NATURES,
  SUPPLY_STATUSES,
  type CantineService,
  type ClassSuppliesConfiguration,
  type CyclesOffered,
  type EducationCycle,
  type ExamFeeItem,
  type FeeInstallment,
  type ExamFeeItem,
  type FeeItem,
  type FeesStructure,
  type Frequency,
  type OfferedCycle,
  type OfferedLevel,
  type OptionalServices,
  type SchoolNature,
  type SchoolSuppliesByClass,
  type SeriesCode,
  type SupplyEquipment,
  type SupplyKitPreset,
  type SupplyManual,
  type SupplyStationery,
  type TenuesService,
  type TransportService,
  type UniformItem,
} from "./types"

// ─── Primitives ─────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Tableau sûr : toute valeur non-tableau devient `[]`. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Chaîne sûre, rognée. Toute valeur non-chaîne devient `""`. */
function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback
}

/**
 * Montant en FCFA : entier ≥ 0. Une saisie « 12 500 » ou « 12500,00 » devient
 * 12500. Toute valeur non numérique ou négative devient 0 — un montant négatif
 * affiché au parent serait au mieux incompréhensible, au pire litigieux.
 */
function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(/[\s\u00a0,]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(value)
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback
}

/** Date ISO `YYYY-MM-DD` valide, sinon `null` (= calculée à l'exécution). */
function isoDate(value: unknown): string | null {
  const s = str(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10) === s ? s : null
}

/** Entier sûr. `"4"` → 4, `"4ᵉ"` → 0 (repli), `2.7` → 2. */
function int(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const FREQUENCIES = ["mensuel", "trimestriel", "annuel"] as const

/** Périodicité d'un service, « mensuel » par défaut (usage le plus courant). */
function frequency(value: unknown): Frequency {
  return oneOf(value, FREQUENCIES, "mensuel")
}

/**
 * Séries d'un niveau. Le wizard écrit parfois un tableau (`["C", "D"]`), parfois
 * une chaîne séparée par des espaces (`"A C D"` — forme des grilles tarifaires
 * saisies « à la main »). Les deux formes sont acceptées ; les doublons et les
 * entrées vides sont écartés sans erreur.
 */
function seriesList(value: unknown): SeriesCode[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,;]+/)
      : []
  const out: SeriesCode[] = []
  for (const item of raw) {
    const code = str(item)
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

/**
 * Ajoute `months` mois à une date ISO en bornant le jour au dernier jour du
 * mois cible (31/01 + 1 mois = 28/02, jamais 02/03 : une échéance ne doit pas
 * « sauter » dans le mois suivant). Calcul en UTC, donc stable quel que soit le
 * fuseau du serveur.
 */
function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const clamped = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)),
  )
  return clamped.toISOString().slice(0, 10)
}

// ─── Offre académique : `schools.cycles_offered` ────────────────────────────

/**
 * Cycles qu'une nature d'établissement peut légitimement proposer. C'est la
 * table de vérité de la logique conditionnelle du wizard : un CFP ne propose
 * pas de série D, un collège n'a pas de filière professionnelle.
 */
const NATURE_CYCLES: Record<SchoolNature, readonly EducationCycle[]> = {
  primaire: [],
  college: ["general"],
  lycee: ["general", "technique"],
  professionnel: ["technique", "professionnel"],
  islamique: ["general"],
  superieur: ["general", "technique", "professionnel"],
}

/** Nature d'établissement, « lycee » par défaut (cas le plus complet). */
function schoolNature(value: unknown): SchoolNature {
  return oneOf(value, SCHOOL_NATURES, "lycee")
}

function parseOfferedLevel(value: unknown, fallbackCycle: EducationCycle): OfferedLevel | null {
  if (!isRecord(value)) return null
  const gradeLevelName = str(value.grade_level_name)
  // Un niveau sans nom est inutilisable : il serait invisible dans les listes
  // et introuvable dans le sélecteur de classe du parent.
  if (!gradeLevelName) return null
  return {
    grade_level_name: gradeLevelName,
    level: int(value.level),
    cycle: oneOf(value.cycle, EDUCATION_CYCLES, fallbackCycle),
    series: seriesList(value.series),
    diploma: str(value.diploma) || "aucun",
    requires_filiere_choice: bool(value.requires_filiere_choice),
  }
}

function parseOfferedCycle(value: unknown): OfferedCycle | null {
  if (!isRecord(value)) return null
  const key = oneOf(value.key, EDUCATION_CYCLES, "general")
  const levels: OfferedLevel[] = []
  for (const rawLevel of asArray(value.levels)) {
    const level = parseOfferedLevel(rawLevel, key)
    if (level) levels.push(level)
  }
  // Un cycle sans niveau n'apporte rien à l'affichage ni aux tarifs : on
  // l'écarte plutôt que de laisser un badge vide dans la fiche publique.
  if (levels.length === 0) return null
  return {
    key,
    label: str(value.label) || CYCLE_LABELS[key],
    series: seriesList(value.series),
    levels,
  }
}

/**
 * Normalise `schools.cycles_offered`. Un JSONB vide (valeur par défaut de la
 * colonne) donne un établissement de nature « lycee » sans cycle — l'appelant
 * teste `cycles.length > 0` pour savoir si la fiche est renseignée.
 */
export function parseCyclesOffered(value: unknown): CyclesOffered {
  const raw = isRecord(value) ? value : {}
  const cycles: OfferedCycle[] = []
  for (const rawCycle of asArray(raw.cycles)) {
    const cycle = parseOfferedCycle(rawCycle)
    if (cycle) cycles.push(cycle)
  }
  return { nature: schoolNature(raw.nature), cycles }
}

/**
 * La nature déclarée est-elle compatible avec les cycles décrits ?
 * Sert de garde dans le wizard (masquer les sections incohérentes) et de
 * contrôle avant publication de la fiche publique. Une offre vide est
 * cohérente : l'école n'a simplement pas encore saisi ses cycles.
 */
export function isCoherent(value: CyclesOffered): boolean {
  const allowed = NATURE_CYCLES[value.nature] ?? []
  return value.cycles.every((cycle) => allowed.includes(cycle.key))
}

/** Cycles qu'une nature autorise — exposé pour piloter le wizard. */
export function allowedCyclesFor(nature: SchoolNature): readonly EducationCycle[] {
  return NATURE_CYCLES[nature] ?? []
}



// ─── Tarification : `schools.fees_structure` ───────────────────────────────

const FEE_AUDIENCES = ["all", "new_students", "returning"] as const
const FEE_STATUSES = ["affecte", "non_affecte"] as const

/** Un poste tarifaire, ou `undefined` si le poste n'est pas renseigné. */
function parseFeeItem(value: unknown): FeeItem | undefined {
  if (!isRecord(value)) return undefined
  const amount = money(value.amount)
  const label = str(value.label)
  // Un poste à 0 F sans libellé n'est pas un tarif : c'est une case vide du
  // wizard. On le considère comme non renseigné pour ne pas afficher
  // « 0 FCFA » au parent.
  if (amount === 0 && !label) return undefined
  return {
    amount,
    is_mandatory: bool(value.is_mandatory),
    applies_to: oneOf(value.applies_to, FEE_AUDIENCES, "all"),
    status: oneOf(value.status, FEE_STATUSES, "non_affecte"),
    ...(label ? { label } : {}),
  }
}

function parseFeeItems(value: unknown): FeeItem[] {
  return asArray(value).map(parseFeeItem).filter((item): item is FeeItem => Boolean(item))
}

function parseExamFees(value: unknown): ExamFeeItem[] {
  const out: ExamFeeItem[] = []
  for (const rawItem of asArray(value)) {
    if (!isRecord(rawItem)) continue
    const className = str(rawItem.class_name)
    const examName = str(rawItem.exam_name)
    if (!className || !examName) continue
    out.push({
      class_name: className,
      exam_name: examName,
      diploma: str(rawItem.diploma) || "aucun",
      amount: money(rawItem.amount),
      is_mandatory: bool(rawItem.is_mandatory, true),
    })
  }
  return out
}

function parseInstallment(value: unknown): FeeInstallment | null {
  if (!isRecord(value)) return null
  const label = str(value.label)
  const amount = money(value.amount)
  if (!label && amount === 0) return null
  return {
    label: label || "Tranche",
    position: Math.max(1, int(value.position, 1)),
    amount,
    due_date: isoDate(value.due_date),
    status: oneOf(value.status, FEE_STATUSES, "non_affecte"),
  }
}

/**
 * Normalise `schools.fees_structure`. Les tranches sont triées par `position`
 * puis renumérotées de 1 à n : le rang affiché au parent reflète l'ordre réel
 * de l'échéancier, même si le wizard a laissé des trous (1, 3, 7).
 */
export function parseFeesStructure(value: unknown): FeesStructure {
  const raw = isRecord(value) ? value : {}
  const installments: FeeInstallment[] = []
  for (const rawInstallment of asArray(raw.installments)) {
    const installment = parseInstallment(rawInstallment)
    if (installment) installments.push(installment)
  }
  installments.sort((a, b) => a.position - b.position)

  const notes = str(raw.notes)
  return {
    registration_fee: parseFeeItem(raw.registration_fee),
    academic_fee: parseFeeItem(raw.academic_fee),
    registration_fees: parseFeeItems(raw.registration_fees),
    school_fees: parseFeeItems(raw.school_fees),
    exam_fees: parseExamFees(raw.exam_fees),
    installments: installments.map((item, index) => ({ ...item, position: index + 1 })),
    currency: str(raw.currency) || DEFAULT_CURRENCY,
    ...(notes ? { notes } : {}),
  }
}

/**
 * Complète les échéances manquantes (`due_date === null`) à partir du début de
 * l'année scolaire. Le wizard laisse volontairement ce champ vide quand l'école
 * répartit ses tranches « tous les N mois » : les tranches 1..n sont alors
 * datées de `yearStart + (n - 1) × monthsBetween`.
 *
 * Les dates saisies explicitement sont conservées telles quelles — une école
 * qui fixe au 15/12 la tranche 2 ne doit pas voir sa date réécrite.
 *
 * Si `yearStart` n'est pas une date ISO valide, la liste est renvoyée inchangée
 * (échéances `null` comprises) plutôt que d'inventer des dates.
 */
export function resolveInstallmentDueDates(
  installments: readonly FeeInstallment[],
  yearStart: string | null,
  monthsBetween = 3,
): FeeInstallment[] {
  const start = isoDate(yearStart)
  if (!start) return installments.map((item) => ({ ...item }))
  const step = Math.max(1, int(monthsBetween, 3))
  return installments.map((item) =>
    item.due_date
      ? { ...item }
      : { ...item, due_date: addMonths(start, (item.position - 1) * step) },
  )
}

/**
 * Montant total de l'échéancier. Sert de contrôle de cohérence dans le wizard :
 * l'écart avec `academic_fee + registration_fee` est signalé à la direction
 * sans être bloquant.
 */
export function totalInstallments(installments: readonly FeeInstallment[]): number {
  return installments.reduce((sum, item) => sum + item.amount, 0)
}


// ─── Services optionnels : `schools.optional_services` (Zero-Image) ─────────

const TRANSPORT_TYPES = ["zone", "fixed", "none"] as const
const CANTINE_TYPES = ["regime", "fixed", "none"] as const
const TENUES_TYPES = ["uniform", "dress_code", "none"] as const

function parseTransport(value: unknown): TransportService {
  const raw = isRecord(value) ? value : {}
  const zones: TransportService["zones"] = []
  for (const rawZone of asArray(raw.zones)) {
    if (!isRecord(rawZone)) continue
    const name = str(rawZone.name)
    if (!name) continue
    zones.push({ name, price: money(rawZone.price), frequency: frequency(rawZone.frequency) })
  }
  return {
    enabled: bool(raw.enabled),
    type: oneOf(raw.type, TRANSPORT_TYPES, "none"),
    zones,
    // Icône Lucide, jamais une photo d'autocar : repli sur « bus ».
    vehicle_icon: str(raw.vehicle_icon) || "bus",
    frequency: frequency(raw.frequency),
  }
}

function parseCantine(value: unknown): CantineService {
  const raw = isRecord(value) ? value : {}
  const regimes: CantineService["regimes"] = []
  for (const rawRegime of asArray(raw.regimes)) {
    if (!isRecord(rawRegime)) continue
    const name = str(rawRegime.name)
    if (!name) continue
    const description = str(rawRegime.description)
    regimes.push({
      name,
      price: money(rawRegime.price),
      frequency: frequency(rawRegime.frequency),
      ...(description ? { description } : {}),
    })
  }
  return {
    enabled: bool(raw.enabled),
    type: oneOf(raw.type, CANTINE_TYPES, "none"),
    regimes,
    meal_icon: str(raw.meal_icon) || "utensils",
    frequency: frequency(raw.frequency),
  }
}

function parseUniformItem(value: unknown): UniformItem | null {
  if (!isRecord(value)) return null
  const name = str(value.name)
  if (!name) return null
  return {
    name,
    description: str(value.description),
    icon: str(value.icon) || "shirt",
    // Clé de palette côté UI (« white », « navy »…), jamais un code hex.
    color: str(value.color) || "slate",
    price: money(value.price),
    one_time: bool(value.one_time, true),
  }
}

function parseTenues(value: unknown): TenuesService {
  const raw = isRecord(value) ? value : {}
  const items: UniformItem[] = []
  for (const rawItem of asArray(raw.items)) {
    const item = parseUniformItem(rawItem)
    if (item) items.push(item)
  }
  return {
    enabled: bool(raw.enabled),
    type: oneOf(raw.type, TENUES_TYPES, "none"),
    items,
    badge_color: str(raw.badge_color) || "slate",
  }
}

/**
 * Normalise `schools.optional_services`. Les trois services sont toujours
 * présents (`enabled: false`, `type: "none"`) : l'UI décide d'afficher ou non
 * la section sans avoir à tester `undefined`.
 */
export function parseOptionalServices(value: unknown): OptionalServices {
  const raw = isRecord(value) ? value : {}
  return {
    transport: parseTransport(raw.transport),
    cantine: parseCantine(raw.cantine),
    tenues: parseTenues(raw.tenues),
  }
}

// ─── Fournitures : `school_supplies.configurations` ─────────────────────────
//
// Le JSONB est indexé par nom de classe (« 3eme », « Tle D »). Deux règles
// structurantes : (1) une classe sans manuel reste une classe valide — un
// établissement peut publier sa tarification avant ses listes de fournitures ;
// (2) `class_label` retombe sur la clé du dictionnaire, de sorte qu'un JSONB
// saisi sans libellé reste affichable.

function parseManual(value: unknown): SupplyManual | null {
  if (!isRecord(value)) return null
  const title = str(value.title)
  const subject = str(value.subject)
  // Sans titre ni matière, la ligne n'est pas exploitable dans un PDF : on la
  // rejette plutôt que d'imprimer une puce vide.
  if (!title && !subject) return null
  const isbn = str(value.isbn)
  return {
    subject,
    title,
    editor: str(value.editor),
    ...(isbn ? { isbn } : {}),
    icon: str(value.icon) || "book-open",
    required_for_inscription: bool(value.required_for_inscription),
  }
}

function parseStationery(value: unknown): SupplyStationery | null {
  if (!isRecord(value)) return null
  const name = str(value.name)
  if (!name) return null
  const notes = str(value.notes)
  return {
    category: str(value.category) || "Divers",
    name,
    // Quantité textuelle : « 1 », « 4 », « 1 paquet de 100 ».
    quantity: str(value.quantity) || "1",
    icon: str(value.icon) || "file-text",
    ...(notes ? { notes } : {}),
  }
}

function parseEquipment(value: unknown): SupplyEquipment | null {
  if (!isRecord(value)) return null
  const name = str(value.name)
  if (!name) return null
  const colorHint = str(value.color_hint)
  return {
    name,
    quantity: str(value.quantity) || "1",
    required_for_inscription: bool(value.required_for_inscription),
    icon: str(value.icon) || "file-text",
    ...(colorHint ? { color_hint: colorHint } : {}),
  }
}

/**
 * Normalise la configuration d'UNE classe. Ne renvoie jamais `null` : un JSONB
 * vide produit une configuration brouillon vide, que le wizard peut éditer et
 * que le portail parent masquera (statut ≠ published).
 */
export function parseClassSupplies(
  value: unknown,
  className = "",
): ClassSuppliesConfiguration {
  const raw = isRecord(value) ? value : {}

  const manuals: SupplyManual[] = []
  for (const item of asArray(raw.manuals)) {
    const parsed = parseManual(item)
    if (parsed) manuals.push(parsed)
  }
  const stationery: SupplyStationery[] = []
  for (const item of asArray(raw.stationery)) {
    const parsed = parseStationery(item)
    if (parsed) stationery.push(parsed)
  }
  const equipment: SupplyEquipment[] = []
  for (const item of asArray(raw.equipment)) {
    const parsed = parseEquipment(item)
    if (parsed) equipment.push(parsed)
  }

  const series = str(raw.series)
  return {
    status: oneOf(raw.status, SUPPLY_STATUSES, "draft"),
    class_label: str(raw.class_label) || className,
    level: int(raw.level),
    cycle: str(raw.cycle),
    ...(series ? { series } : {}),
    year: str(raw.year),
    manuals,
    stationery,
    equipment,
  }
}

/**
 * Normalise la colonne complète `school_supplies.configurations`.
 * Les clés sont triées en ordre naturel français : « 6eme » avant « 10eme »,
 * et non l'ordre lexicographique (« 10eme » avant « 6eme »). Le tri est
 * volontairement déterministe : la liste alimente un `<select>` rendu côté
 * serveur, dont l'ordre doit être stable entre HTML et hydratation.
 */
export function parseSchoolSupplies(value: unknown): SchoolSuppliesByClass {
  const raw = isRecord(value) ? value : {}
  const out: SchoolSuppliesByClass = {}
  for (const className of Object.keys(raw).sort(compareClassNames)) {
    const entry = raw[className]
    // Une valeur non-objet (« null », chaîne) n'a aucun sens métier : ignorée.
    if (!isRecord(entry)) continue
    out[className] = parseClassSupplies(entry, className)
  }
  return out
}

/**
 * Comparateur d'ordre naturel pour les noms de classes : compare les fragments
 * numériques comme des nombres, le reste alphabétiquement, en français.
 */
export function compareClassNames(a: string, b: string): number {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" })
}

/** Toutes les classes connues, dans l'ordre d'affichage. */
export function listSupplyClassNames(supplies: SchoolSuppliesByClass): string[] {
  return Object.keys(supplies)
}

/**
 * Classes réellement publiées — c'est la liste proposée au parent dans le
 * sélecteur de classe (un brouillon ne doit jamais fuiter côté public).
 */
export function publishedSupplyClassNames(
  supplies: SchoolSuppliesByClass,
): string[] {
  return Object.keys(supplies).filter((key) => supplies[key].status === "published")
}

// ─── Opérations pures sur les fournitures (wizard Direction) ────────────────
//
// Ces fonctions renvoient de NOUVELLES structures (aucune mutation en place) :
// elles alimentent le state React du wizard, où la mutation directe casserait
// la détection de changement.

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Duplique les fournitures d'une classe vers une autre (« de la 6ᵉ vers la
 * 5ᵉ ») — le gain de temps principal du wizard, la papeterie étant largement
 * commune d'un niveau à l'autre. La copie repart en `draft` : dupliquer ne
 * vaut pas publication, la direction doit relire la liste cible.
 *
 * Renvoie la carte inchangée si la classe source n'existe pas (pas de throw :
 * l'appelant affiche un message d'erreur, il ne plante pas).
 */
export function duplicateClassSupplies(
  supplies: SchoolSuppliesByClass,
  fromClass: string,
  toClass: string,
  toLabel?: string,
): SchoolSuppliesByClass {
  const source = supplies[fromClass]
  if (!source || !toClass.trim() || toClass === fromClass) return supplies

  return {
    ...supplies,
    [toClass]: {
      ...source,
      status: "draft",
      class_label: toLabel?.trim() || toClass,
      // Copie profonde des tableaux : sinon la 6ᵉ et la 5ᵉ partageraient les
      // mêmes objets et une édition se propagerait aux deux classes.
      manuals: source.manuals.map((m) => ({ ...m })),
      stationery: source.stationery.map((s) => ({ ...s })),
      equipment: source.equipment.map((e) => ({ ...e })),
    },
  }
}

/**
 * Fusionne un kit préréglé (programme national) dans une configuration de
 * classe, SANS écraser l'existant : les entrées déjà présentes sont conservées
 * telles quelles, seules les nouveautés sont ajoutées. Une direction qui coche
 * deux kits successifs obtient donc l'union des deux, sans doublon.
 */
export function mergeKitPreset(
  config: ClassSuppliesConfiguration,
  preset: SupplyKitPreset,
): ClassSuppliesConfiguration {
  const manualKeys = new Set(
    config.manuals.map((m) => `${normalizeKey(m.subject)}|${normalizeKey(m.title)}`),
  )
  const manuals = [...config.manuals]
  for (const manual of preset.manuals) {
    const key = `${normalizeKey(manual.subject)}|${normalizeKey(manual.title)}`
    if (manualKeys.has(key)) continue
    manualKeys.add(key)
    manuals.push({ ...manual })
  }

  const stationeryKeys = new Set(
    config.stationery.map((s) => `${normalizeKey(s.category)}|${normalizeKey(s.name)}`),
  )
  const stationery = [...config.stationery]
  for (const item of preset.stationery) {
    const key = `${normalizeKey(item.category)}|${normalizeKey(item.name)}`
    if (stationeryKeys.has(key)) continue
    stationeryKeys.add(key)
    stationery.push({ ...item })
  }

  const equipmentKeys = new Set(config.equipment.map((e) => normalizeKey(e.name)))
  const equipment = [...config.equipment]
  for (const item of preset.equipment) {
    const key = normalizeKey(item.name)
    if (equipmentKeys.has(key)) continue
    equipmentKeys.add(key)
    equipment.push({ ...item })
  }

  return { ...config, manuals, stationery, equipment }
}

