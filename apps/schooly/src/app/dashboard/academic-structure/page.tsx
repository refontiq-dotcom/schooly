"use client"

import AcademicStructureTabs from "./tabs/page"

/**
 * Layout du module structure académique.
 * Le hub d'onglets (./tabs) orchestre la navigation pédagogique entre
 * années, niveaux, classes, matières, matrice et bascule.
 */
export default function AcademicStructureLayout() {
  return <AcademicStructureTabs />
}
