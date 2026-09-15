import {
  Megaphone,
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  BookOpen,
  CalendarDays,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronLeft,
  School,
  Clock,
  Bell,
  Bus,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

export const NAV_BY_ROLE: Record<string, NavItem[]> = {
  super_admin: [
    { label: "Vue Globale", href: "/dashboard/super-admin", icon: LayoutDashboard },
    { label: "Établissements", href: "/dashboard/super-admin/schools", icon: School },
    { label: "Utilisateurs", href: "/dashboard/super-admin/users", icon: Users },
    { label: "Facturation", href: "/dashboard/billing", icon: CreditCard },
  ],
  direction: [
    { label: "Tableau de bord", href: "/dashboard/direction", icon: LayoutDashboard },
    { label: "Inscriptions", href: "/dashboard/direction/admissions", icon: Users },
    { label: "Structure académique", href: "/dashboard/academic-structure", icon: GraduationCap },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Moratoires", href: "/dashboard/direction/finance/moratoriums", icon: Clock },
    { label: "Relances", href: "/dashboard/direction/finance/reminders", icon: Bell },
    { label: "Facturation", href: "/dashboard/billing", icon: CreditCard },
    { label: "Services", href: "/dashboard/services/transport", icon: Bus },
    { label: "Paramètres", href: "/dashboard/direction/settings", icon: Settings },
    { label: "Trouvetou", href: "/dashboard/admin/trouvetou", icon: Megaphone },
  ],
  compta: [
    { label: "Tableau de bord", href: "/dashboard/direction", icon: LayoutDashboard },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Services", href: "/dashboard/services/transport", icon: Bus },
  ],
  caisse: [
    { label: "Encaissement", href: "/dashboard/caisse", icon: CreditCard },
    { label: "Historique", href: "/dashboard/caisse/history", icon: CalendarDays },
    { label: "Clôture de caisse", href: "/dashboard/caisse/close", icon: ShieldCheck },
  ],
  professeur: [
    { label: "Mes cours", href: "/dashboard/pedagogie", icon: BookOpen },
    { label: "Appel", href: "/dashboard/pedagogie/attendance", icon: Users },
    { label: "Notes", href: "/dashboard/pedagogie/grades", icon: GraduationCap },
  ],
  surveillance: [
    { label: "Discipline & Vie scolaire", href: "/dashboard/pedagogie/discipline", icon: ShieldCheck },
    { label: "Absences & Appel", href: "/dashboard/pedagogie/attendance", icon: Users },
  ],
}

export { ChevronLeft, LogOut }
