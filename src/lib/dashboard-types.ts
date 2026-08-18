export type Folder = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  collapsed: boolean;
  position: number;
  createdAt: string | Date;
};

export type Service = {
  id: number;
  folderId: number | null;
  name: string;
  url: string;
  description: string | null;
  iconType: "favicon" | "simple-icon" | "lucide" | "url" | "emoji";
  iconValue: string | null;
  faviconCache: string | null;
  iconMissing: boolean;
  openInNewTab: boolean;
  statusCheckEnabled: boolean;
  statusUrl: string | null;
  tags: string[];
  position: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type DashboardData = {
  folders: Folder[];
  services: Service[];
  settings: Record<string, string>;
};

export type ServiceDraft = Partial<Service> & {
  name: string;
  url: string;
  tagsText: string;
};

export type ServiceStatus = {
  status: "up" | "down" | "unknown";
  responseTime: number | null;
};
