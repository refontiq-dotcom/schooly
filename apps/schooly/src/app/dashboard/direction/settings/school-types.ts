export const SCHOOL_TYPES = [
  { value: "primaire", label: "Primaire" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "professionnel", label: "Professionnel / Technique" },
  { value: "islamique", label: "Islamique / Franco-arabe" },
  { value: "superieur", label: "Supérieur" },
] as const

export const SCHOOL_TYPE_VALUES = SCHOOL_TYPES.map((t) => t.value) as readonly string[]
