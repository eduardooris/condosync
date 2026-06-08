import {
  LayoutDashboard,
  Building2,
  Receipt,
  Newspaper,
  FolderOpen,
  ClipboardList,
  BarChart2,
  Settings,
  Wallet,
  CalendarDays,
  UserRoundPlus,
  PackageCheck,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/charges', label: 'Cobranças', icon: Receipt },
      { to: '/expenses', label: 'Despesas', icon: Wallet },
    ],
  },
  {
    id: 'moradores',
    label: 'Moradores',
    adminOnly: true,
    items: [
      { to: '/units', label: 'Unidades & moradores', icon: Building2 },
      { to: '/visitors', label: 'Visitantes', icon: UserRoundPlus },
      { to: '/portaria-admin', label: 'Portaria virtual', icon: DoorOpen },
      { to: '/correspondences', label: 'Correspondências', icon: PackageCheck },
    ],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação',
    items: [
      { to: '/bulletin', label: 'Mural de recados', icon: Newspaper },
      { to: '/occurrences', label: 'Ocorrências', icon: ClipboardList },
    ],
  },
  {
    id: 'servicos',
    label: 'Serviços',
    items: [
      { to: '/reservations', label: 'Reservas', icon: CalendarDays },
      { to: '/polls', label: 'Enquetes', icon: BarChart2 },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    items: [{ to: '/documents', label: 'Documentos', icon: FolderOpen }],
  },
  {
    id: 'conta',
    label: 'Conta',
    items: [{ to: '/settings', label: 'Configurações', icon: Settings }],
  },
];
