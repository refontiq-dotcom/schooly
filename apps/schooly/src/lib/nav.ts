import {
  Megaphone,
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  BookOpen,
  CalendarDays,
  Clock,
  ShieldCheck,
  Settings,
  Wrench,
  LogOut,
  ChevronLeft,
  School,
  Bell,
  QrCode,
  Scan,
  AlertTriangle,
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
    { label: "Personnel & rôles", href: "/dashboard/direction/staff", icon: Users },
    { label: "Inscriptions", href: "/dashboard/direction/admissions", icon: Users },
    { label: "Structure académique", href: "/dashboard/academic-structure", icon: GraduationCap },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Relances", href: "/dashboard/direction/finance/reminders", icon: Bell },
    { label: "Facturation", href: "/dashboard/billing", icon: CreditCard },
    { label: "Rapports", href: "/dashboard/direction/reports", icon: BookOpen },
    { label: "Services", href: "/dashboard/services/transport", icon: Bus },
    { label: "Paramètres", href: "/dashboard/direction/settings", icon: Settings },
    { label: "Trouvetou", href: "/dashboard/admin/trouvetou", icon: Megaphone },
  ],
  secretariat: [
    { label: "Inscriptions", href: "/dashboard/direction/admissions", icon: Users },
    { label: "Structure académique", href: "/dashboard/academic-structure", icon: GraduationCap },
    { label: "Services", href: "/dashboard/services/transport", icon: Bus },
  ],
  compta: [
    { label: "Tableau de bord financier", href: "/dashboard/direction/finance", icon: LayoutDashboard },
    { label: "Finance", href: "/dashboard/direction/finance", icon: CreditCard },
    { label: "Relances", href: "/dashboard/direction/finance/reminders", icon: Bell },
    { label: "Rapports", href: "/dashboard/direction/reports", icon: BookOpen },
  ],
  informatique: [
    { label: "Tableau de bord", href: "/dashboard/informatique", icon: LayoutDashboard },
    { label: "Configuration", href: "/dashboard/academic-structure", icon: Wrench },
    { label: "Emploi du temps", href: "/dashboard/informatique/emploi-du-temps", icon: CalendarDays },
    { label: "Paramètres établissement", href: "/dashboard/direction/settings", icon: Settings },
    { label: "Bulletins & rapports", href: "/dashboard/direction/reports", icon: BookOpen },
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
