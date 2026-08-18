import {
  Activity,
  Archive,
  Bell,
  Box,
  BriefcaseBusiness,
  Cloud,
  Database,
  Film,
  FolderCog,
  Globe,
  HardDrive,
  House,
  KeyRound,
  Monitor,
  Network,
  RadioTower,
  Router,
  Server,
  Settings,
  Shield,
  Terminal,
  type LucideIcon,
} from "lucide-react";

const lucideIcons: Record<string, LucideIcon> = {
  activity: Activity,
  archive: Archive,
  bell: Bell,
  box: Box,
  "briefcase-business": BriefcaseBusiness,
  cloud: Cloud,
  database: Database,
  "file-server": Server,
  film: Film,
  "folder-cog": FolderCog,
  globe: Globe,
  "hard-drive": HardDrive,
  house: House,
  "key-round": KeyRound,
  monitor: Monitor,
  network: Network,
  "radio-tower": RadioTower,
  router: Router,
  server: Server,
  settings: Settings,
  shield: Shield,
  terminal: Terminal,
};

export function resolveLucideIcon(value: string | null | undefined): LucideIcon | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

  return lucideIcons[normalized] ?? null;
}
