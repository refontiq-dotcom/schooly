// ============================================================================
// M3 — Kits prereglés (programmes nationaux) : squelettes de fournitures
// proposés a la direction pour pre-remplir une classe. Vivent dans le code,
// pas en base. Fusion non-destructive via mergeKitPreset (M1).
// ============================================================================

import type { SupplyKitPreset } from "./types"

export const SUPPLY_KIT_PRESETS: SupplyKitPreset[] = [
  {
    id: "general-6e",
    label: "Kit 6e — Enseignement Général",
    cycle: "general",
    levels: [1],
    description: "Tronc commun college : francais, maths, papeterie de base.",
    manuals: [
      { subject: "Francais", title: "Francais 6e", editor: "Programme national", icon: "book", required_for_inscription: false },
      { subject: "Mathematiques", title: "Maths 6e", editor: "Programme national", icon: "calculator", required_for_inscription: false },
    ],
    stationery: [
      { category: "Ecriture", name: "Cahiers 200 pages", quantity: "4", icon: "notebook" },
      { category: "Ecriture", name: "Stylos bleus", quantity: "4", icon: "pen" },
      { category: "Calcul", name: "Ensemble geometrique", quantity: "1", icon: "ruler" },
    ],
    equipment: [
      { name: "Rame de papier A4", quantity: "1", required_for_inscription: true, icon: "package" },
    ],
  },
  {
    id: "general-3e",
    label: "Kit 3e — Enseignement Général (BEPC)",
    cycle: "general",
    levels: [3],
    description: "Annee d'examen : annales + papeterie renforcee.",
    manuals: [
      { subject: "Francais", title: "Francais 3e", editor: "Programme national", icon: "book", required_for_inscription: false },
      { subject: "Mathematiques", title: "Maths 3e + annales BEPC", editor: "Programme national", icon: "calculator", required_for_inscription: false },
      { subject: "SVT", title: "SVT 3e", editor: "Programme national", icon: "flask", required_for_inscription: false },
    ],
    stationery: [
      { category: "Ecriture", name: "Cahiers 200 pages", quantity: "6", icon: "notebook" },
      { category: "Ecriture", name: "Copies doubles", quantity: "1 paquet", icon: "files" },
    ],
    equipment: [
      { name: "Rame de papier A4", quantity: "1", required_for_inscription: true, icon: "package" },
      { name: "Blouse de SVT", quantity: "1", required_for_inscription: true, icon: "shirt" },
    ],
  },
  {
    id: "general-tle",
    label: "Kit Terminale — Enseignement Général (Bac)",
    cycle: "general",
    levels: [7],
    description: "Annee du bac : annales par serie + materiel d'examen.",
    manuals: [
      { subject: "Philosophie", title: "Philo Tle", editor: "Programme national", icon: "book", required_for_inscription: false },
      { subject: "Mathematiques", title: "Maths Tle + annales Bac", editor: "Programme national", icon: "calculator", required_for_inscription: false },
    ],
    stationery: [
      { category: "Ecriture", name: "Cahiers 300 pages", quantity: "4", icon: "notebook" },
      { category: "Ecriture", name: "Copies doubles", quantity: "2 paquets", icon: "files" },
    ],
    equipment: [
      { name: "Calculatrice scientifique", quantity: "1", required_for_inscription: false, icon: "calculator" },
    ],
  },
  {
    id: "technique-2nde",
    label: "Kit 2nde Technique (F/G)",
    cycle: "technique",
    levels: [4],
    description: "Tronc technique : dessin industriel + calcul.",
    manuals: [
      { subject: "Technologie", title: "Technologie 2nde T", editor: "Programme national", icon: "wrench", required_for_inscription: false },
      { subject: "Mathematiques", title: "Maths 2nde T", editor: "Programme national", icon: "calculator", required_for_inscription: false },
    ],
    stationery: [
      { category: "Dessin", name: "Papier millimetre A3", quantity: "1 pochette", icon: "drafting" },
      { category: "Dessin", name: "Crayons HB/2H", quantity: "4", icon: "pencil" },
    ],
    equipment: [
      { name: "Blouse d'atelier", quantity: "1", required_for_inscription: true, icon: "shirt" },
      { name: "Boite de dessin technique", quantity: "1", required_for_inscription: false, icon: "compass" },
    ],
  },
  {
    id: "pro-cap",
    label: "Kit CAP — Enseignement Professionnel",
    cycle: "professionnel",
    levels: [1, 2],
    description: "Filiere pro : EPI + outillage de base.",
    manuals: [
      { subject: "Enseignement pro", title: "Technologie pro (metier)", editor: "Programme national", icon: "wrench", required_for_inscription: false },
    ],
    stationery: [
      { category: "Ecriture", name: "Cahiers 200 pages", quantity: "3", icon: "notebook" },
    ],
    equipment: [
      { name: "EPI (gants + lunettes)", quantity: "1 lot", required_for_inscription: true, icon: "hard-hat" },
      { name: "Caisse a outils de base", quantity: "1", required_for_inscription: true, icon: "toolbox" },
    ],
  },
]

export function presetsForCycle(cycle: string): SupplyKitPreset[] {
  return SUPPLY_KIT_PRESETS.filter((p) => p.cycle === cycle)
}
