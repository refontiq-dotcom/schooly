import {
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
  QrCode,
  Scan,
  AlertTriangle,
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
  ],
  direction: [
    { label: "Tableau de bord", href: "/dashboard/direction", icon: LayoutDashboard },
    { label: "Inscriptions", href: "/dashboard/direction/admissions", icon: Users },
    { label: "Structure académique", href: "/dashboard/academic-structure", icon: GraduationCap },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Moratoires", href: "/dashboard/direction/finance/moratoriums", icon: Clock },
    { label: "Relances", href: "/dashboard/direction/finance/reminders", icon: Bell },
    { label: "Rapports", href: "/dashboard/direction/reports", icon: BookOpen },
    { label: "Paramètres", href: "/dashboard/direction/settings", icon: Settings },
  ],
  compta: [
    { label: "Tableau de bord", href: "/dashboard/direction", icon: LayoutDashboard },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Rapports", href: "/dashboard/direction/reports", icon: BookOpen },
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
    { label: "Vie scolaire", href: "/dashboard/pedagogie/vie-scolaire", icon: ShieldCheck },
    { label: "Accès QR", href: "/dashboard/pedagogie/vie-scolaire", icon: QrCode },
    { label: "Journal d'accès", href: "/dashboard/pedagogie/vie-scolaire", icon: Scan },
    { label: "Retenues", href: "/dashboard/pedagogie/vie-scolaire", icon: Clock },
    { label: "Alertes décrochage", href: "/dashboard/pedagogie/vie-scolaire", icon: AlertTriangle },
  ],
}

export { ChevronLeft, LogOut }
