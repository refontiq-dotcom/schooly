"use client"

/**
 * Socle visuel « façon Gemini » (page d'accueil + portail élève).
 *
 * Principe : des composants clients minuscules qui *enrobent* du contenu
 * rendu côté serveur (children sérialisés en RSC) — les pages serveur comme
 * `/eleve` peuvent donc les utiliser sans devenir clientes.
 *
 * Palette : dégradés pastel émeraude → cyan → violet, cohérents avec le
 * primaire émeraude du thème (tokens oklch de globals.css).
 */

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"
import type { ReactNode } from "react"

// ————— Décor : blobs dégradés flottants ————————————————————————————

/**
 * Fond animé : trois blobs floutés à dérive lente (CSS, GPU-friendly),
 * superposés à un dégradé radial très pâle. Purement décoratif
 * (aria-hidden), sous le contenu (z-0) et dans un layer isolé.
 */
export function GeminiBackdrop() {
  return (
    <div aria-hidden className="gemini-backdrop">
      <div className="gemini-blob gemini-blob--emerald" />
      <div className="gemini-blob gemini-blob--sky" />
      <div className="gemini-blob gemini-blob--violet" />
    </div>
  )
}

// ————— Typographie : titre à dégradé animé ———————————————————————

/**
 * Texte à dégradé animé (balayage lent type Gemini « Hello »).
 * La couleur de repli (`text-foreground`) garantit la lisibilité si les
 * dégradés CSS ne s'appliquent pas.
 */
export function GradientText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`gemini-text-gradient ${className}`}>{children}</span>
}

// ————— Animations d'entrée ———————————————————————————————————————

type FadeInProps = {
  children: ReactNode
  /** Délai avant l'entrée, en secondes (cascade manuelle). */
  delay?: number
  /** Décalage vertical initial, en px (défaut 12). */
  y?: number
  className?: string
} & Omit<HTMLMotionProps<"div">, "children">

/**
 * Entrée douce (fondu + léger glissement vers le haut).
 * `useReducedMotion` désactive le mouvement si l'OS l'exige (a11y) —
 * seul le fondu reste.
 */
export function FadeIn({ children, delay = 0, y = 12, className, ...rest }: FadeInProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/**
 * Cascade : chaque enfant direct entre l'un après l'autre.
 * Usage : <Stagger>{items.map(...)}</Stagger> — le delay est calculé
 * par index (borné à 0,4 s pour éviter les cascades interminables).
 */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <FadeIn key={i} delay={Math.min(i * 0.07, 0.4)}>
              {child}
            </FadeIn>
          ))
        : children}
    </div>
  )
}
