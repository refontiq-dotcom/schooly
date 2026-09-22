// ============================================================================
// lib/fiches/types.ts — Types métier du module « Fiches de renseignement
// intelligentes & Fournitures » (migration 20260920000000).
//
// POURQUOI CE FICHIER : le module stocke des colonnes JSONB (cycles_offered,
// fees_structure, optional_services) et une table school_supplies dont le
// champ `configurations` est un JSONB indexé par nom de classe. Le client
// Supabase du projet est volontairement NON typé (cf. AdminClient dans
// academic-structure/actions.ts), donc la forme réelle du JSONB n'est garantie
// par personne à la compilation : elle doit l'être ici, et à l'exécution par
// les normaliseurs de ce module.
//
// RÈGLE « ZERO-IMAGE » : aucune photo n'est stockée. Les représentations
// visuelles (bâtiments, cars, tenues, cantine) sont des libellés d'icônes
// Lucide (`icon`) + des couleurs de badge (`color`) rendus côté UI.
// Seul le logo de l'école est une URL externe (schools.cover_photo_url).
//
// Toutes les fonctions exportées ici sont PURES (aucune I/O) et testées dans
// fiches.test.ts — même convention que lib/discounts.ts.
// ============================================================================

// ─── Enseignement : types, cycles, séries, diplômes ─────────────────────────

/** Nature de l'établissement — pilote les sections conditionnelles du wizard. */
export const SCHOOL_NATURES = [
  "primaire",
  "college",
  "lycee",
  "professionnel",
  "islamique",
  "superieur",
] as const
export type SchoolNature = (typeof SCHOOL_NATURES)[number]

export const EDUCATION_CYCLES = ["primaire", "general", "technique", "professionnel", "islamique", "superieur"] as const
export type EducationCycle = (typeof EDUCATION_CYCLES)[number]

/** Libellés d'affichage des cycles (aucune image : badge + couleur). */
export const CYCLE_LABELS: Record<EducationCycle, string> = {
  primaire: "Enseignement Primaire",
  general: "Enseignement Général",
  technique: "Enseignement Technique",
  professionnel: "Enseignement Professionnel",
  islamique: "Enseignement Islamique / Franco-arabe",
  superieur: "Enseignement Supérieur",
}

/**
 * Série de baccalauréat. Les séries sont listées ici pour valider les saisies
 * du wizard ; `SeriesCode` reste ouvert à `string` là où le JSONB est lu,
 * parce qu'un établissement étranger peut saisir une série hors nomenclature.
 */
export const SERIES_BY_CYCLE: Record<EducationCycle, readonly string[]> = {
  primaire: [],
  islamique: [],
  general: ["A", "A1", "A2", "C", "D", "E"],
  technique: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "G1", "G2", "G3", "H"],
  professionnel: ["T1", "T2"],
  superieur: [],
}
export type SeriesCode = string

/** Diplôme préparé au terme du niveau. */
export type DiplomaKind =
  | "aucun"
  | "cep"
  | "bepc"
  | "bac"
  | "cap"
  | "bt"
  | "bts"
  | "licence"
  | "master"
  | string

/** Un niveau (classe) rattaché à un cycle, avec ses séries et son diplôme. */
export interface OfferedLevel {
  /** Libellé affiché, ex. « Terminale D », « 3ᵉ », « CP1 ». */
  grade_level_name: string
  /** Rang croissant dans le cursus (6ᵉ = 1 … Terminale = 7). */
  level: number
  /** Clé de cycle : general | technique | professionnel. */
  cycle: EducationCycle
  /** Séries admissibles pour ce niveau (ex. « D », « T1 »). */
  series: SeriesCode[]
  /** Diplôme préparé au terme de ce niveau. */
  diploma: DiplomaKind
  /**
   * Le choix de série intervient à l'inscription de ce niveau (1ʳᵉ, Tle).
   * Faux pour un collège : la classe suffit.
   */
  requires_filiere_choice: boolean
}

/** Un cycle d'enseignement proposé par l'établissement. */
export interface OfferedCycle {
  key: EducationCycle
  label?: string
  series: SeriesCode[]
  levels: OfferedLevel[]
}

/**
 * Contenu de `schools.cycles_offered`.
 * `nature` doit rester cohérent avec `schools.school_type` : `isCoherent()`
 * le vérifie et le wizard s'en sert pour masquer/afficher les sections.
 */
export interface CyclesOffered {
  nature: SchoolNature
  cycles: OfferedCycle[]
}

// ─── Tarification : droits d'inscription, scolarité, échéancier ─────────────
//
// STATUT DUPLICITÉ : `fees_structure` NE PORTE PAS le taux de remise fratrie.
// La colonne `schools.multi_child_discount_rate` existe déjà (migration
// 20260908100000) et reste la source unique — ne pas la dupliquer ici.

/**
 * `affecte` : frais/tranche dus par l'élève affecté par l'État (boursier
 * affecté, prix souvent réduit). `non_affecte` : tarif de droit commun, ou
 * poste désactivé par l'école.
 */
export type FeeStatus = "affecte" | "non_affecte"

/** Public visé par un poste tarifaire. */
export type FeeAudience = "all" | "new_students" | "returning"

/** Un poste tarifaire unitaire (droits d'inscription, scolarité…). */
export interface FeeItem {
  /** Montant en FCFA (entier, sans centimes — convention nationale). */
  amount: number
  is_mandatory: boolean
  applies_to: FeeAudience
  status: FeeStatus
  /** Libellé libre affiché au parent (ex. « Scolarité annuelle »). */
  label?: string
}

/**
 * Une tranche de l'échéancier. `due_date` au format ISO `YYYY-MM-DD` ou
 * `null` : dans ce cas la date est calculée à l'exécution à partir du début
 * de l'année scolaire (cf. `resolveInstallmentDueDates`).
 */
export interface FeeInstallment {
  label: string
  /** Rang d'appel de la tranche (1 = à l'inscription). */
  position: number
  amount: number
  due_date: string | null
  status: FeeStatus
}

/** Droit d'examen associé automatiquement à une classe diplômante. */
export interface CustomFeeItem {
  id: string
  label: string
  amount: number
  is_mandatory: boolean
  status: FeeStatus
  applies_to: FeeAudience
}

export interface ExamFeeItem {
  class_name: string
  exam_name: string
  diploma: DiplomaKind
  amount: number
  amount_affecte?: number
  amount_non_affecte?: number
  is_mandatory: boolean
}

/** Contenu de `schools.fees_structure`. */
export interface FeeProfile {
  registration_fees?: FeeItem[]
  school_fees?: FeeItem[]
  exam_fees?: ExamFeeItem[]
  custom_fees?: CustomFeeItem[]
  installments: FeeInstallment[]
  currency: string
  notes?: string
}

export interface FeesStructure {
  /** Champs historiques conservés pour compatibilité. */
  registration_fee?: FeeItem
  academic_fee?: FeeItem
  /** Tarifs distincts selon l'affectation. */
  registration_fees?: FeeItem[]
  school_fees?: FeeItem[]
  /** Droits d'examen par classe diplômante. */
  exam_fees?: ExamFeeItem[]
  /** Tarification séparée par pôle d'enseignement. */
  fee_profiles?: Partial<Record<EducationCycle, FeeProfile>>
  /** Frais personnalisés ajoutés par le directeur. */
  custom_fees?: CustomFeeItem[]
  installments: FeeInstallment[]
  /** Code devise ISO 4217 — « XOF » par défaut en Côte d'Ivoire. */
  currency: string
  /** Conditions et exceptions, affichées telles quelles au parent. */
  notes?: string
}

export const DEFAULT_CURRENCY = "XOF"

// ─── Services optionnels : transport, cantine, tenues (Zero-Image) ──────────

export type Frequency = "mensuel" | "trimestriel" | "annuel"

/** Transport : tarif par zone géographique ou forfait unique. */
export interface TransportService {
  enabled: boolean
  /** `zone` = un tarif par zone ; `fixed` = forfait unique pour tous. */
  type: "zone" | "fixed" | "none"
  zones: Array<{ name: string; price: number; frequency: Frequency }>
  /** Icône Lucide (`bus`, `car`, `car-front`…) — jamais une photo. */
  vehicle_icon: string
  frequency: Frequency
}

/** Cantine : tarif par régime alimentaire ou forfait unique. */
export interface CantineService {
  enabled: boolean
  type: "regime" | "fixed" | "none"
  regimes: Array<{
    name: string
    price: number
    frequency: Frequency
    description?: string
  }>
  /** Icône Lucide (`utensils`, `utensils-crossed`, `soup`…). */
  meal_icon: string
  frequency: Frequency
}

/** Tenue réglementaire : décrite en texte + icône + couleur de badge. */
export interface UniformItem {
  name: string
  description: string
  /** Icône Lucide (`shirt`, `tshirt`, `coat-check`…). */
  icon: string
  /** Couleur du badge côté UI (clé de palette, pas un code hexadécimal). */
  color: string
  price: number
  /** Vrai si l'élève achète la pièce, faux si l'école la fournit/loue. */
  one_time: boolean
}

export interface TenuesService {
  enabled: boolean
  type: "uniform" | "dress_code" | "none"
  items: UniformItem[]
  badge_color: string
}

/** Contenu de `schools.optional_services`. */
export interface OptionalServices {
  transport: TransportService
  cantine: CantineService
  tenues: TenuesService
}

// ─── Fournitures scolaires : manuels, papeterie, matériel d'inscription ─────

/**
 * Les trois familles de fournitures. Le regroupement n'est pas cosmétique :
 * `equipment` (rames, blouses) est ce que le secrétariat exige PHYSIQUEMENT
 * le jour de l'inscription, alors que `manuals`/`stationery` s'achètent librement.
 */
export const SUPPLY_SECTIONS = ["manuals", "stationery", "equipment"] as const
export type SupplySection = (typeof SUPPLY_SECTIONS)[number]

export const SUPPLY_STATUSES = ["draft", "published"] as const
export type SupplyStatus = (typeof SUPPLY_STATUSES)[number]

/** Manuel scolaire, identifié par son ISBN quand il est connu. */
export interface SupplyManual {
  subject: string
  title: string
  editor: string
  isbn?: string
  /** Icône Lucide — jamais une couverture scannée. */
  icon: string
  required_for_inscription: boolean
}

/** Article de papeterie, regroupé par catégorie (Écriture, Calcul…). */
export interface SupplyStationery {
  category: string
  name: string
  /** Quantité en texte : « 1 », « 4 », « 1 paquet de 100 ». */
  quantity: string
  icon: string
  notes?: string
}

/** Matériel exigé à l'inscription (rame de cahiers, blouse…). */
export interface SupplyEquipment {
  name: string
  quantity: string
  required_for_inscription: boolean
  icon: string
  /** Indication de couleur attendue, en texte (ex. « bleu marine »). */
  color_hint?: string
}

/**
 * Fournitures d'UNE classe pour UNE année scolaire — c'est la valeur stockée
 * dans `school_supplies.configurations[className]` en JSONB.
 */
export interface ClassSuppliesConfiguration {
  status: SupplyStatus
  class_label: string
  level: number
  cycle: string
  series?: SeriesCode
  year: string
  manuals: SupplyManual[]
  stationery: SupplyStationery[]
  equipment: SupplyEquipment[]
}

/** Contenu complet de `school_supplies.configurations`, indexé par classe. */
export type SchoolSuppliesByClass = Record<string, ClassSuppliesConfiguration>

/**
 * Kit préréglé : un squelette de fournitures proposé par programme national
 * ou par filière, que la direction coche pour pré-remplir une classe.
 * Ces kits vivent dans le code (supplies/presets/), pas en base.
 */
export interface SupplyKitPreset {
  /** Identifiant stable, ex. « general-3e ». */
  id: string
  label: string
  /** Cycle visé — sert à filtrer les kits proposés selon l'établissement. */
  cycle: EducationCycle
  /** Niveaux auxquels ce kit s'applique (ex. [3] pour la 3ᵉ). */
  levels: number[]
  description?: string
  manuals: SupplyManual[]
  stationery: SupplyStationery[]
  equipment: SupplyEquipment[]
}

// ─── Ligne `school_supplies` telle que lue depuis Supabase ──────────────────

/**
 * Forme de la ligne retournée par PostgREST. `configurations` est volontairement
 * typé `unknown` : c'est `parseSchoolSupplies()` qui garantit la forme.
 */
export interface SchoolSuppliesRow {
  id: string
  school_id: string
  grade_level_id: string | null
  class_name: string
  academic_year_id: string | null
  configurations: unknown
  status: SupplyStatus
  published_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

