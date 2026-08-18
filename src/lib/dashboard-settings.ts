export type DashboardSettings = {
  title: string;
  theme: "light" | "dark" | "system";
  accent: "violet" | "blue" | "emerald";
  columns: number;
  cardSize: "compact" | "medium" | "large";
  statusCheckInterval: number;
  showSearchOnLoad: boolean;
  enableExternalFaviconService: boolean;
  viewMode: "grid" | "list" | "tags";
  sortMode: "manual" | "alphabetical" | "recent";
};

export function parseDashboardSettings(settings: Record<string, string>): DashboardSettings {
  return {
    title: settings.title || "Dasho",
    theme: settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system",
    accent: settings.accent === "blue" || settings.accent === "emerald" ? settings.accent : "violet",
    columns: Number(settings.columns) || 6,
    cardSize: settings.cardSize === "medium" || settings.cardSize === "large" ? settings.cardSize : "compact",
    statusCheckInterval: Number(settings.statusCheckInterval) || 60,
    showSearchOnLoad: settings.showSearchOnLoad === "true",
    enableExternalFaviconService: settings.enableExternalFaviconService !== "false",
    viewMode: settings.viewMode === "list" || settings.viewMode === "tags" ? settings.viewMode : "grid",
    sortMode: settings.sortMode === "alphabetical" || settings.sortMode === "recent" ? settings.sortMode : "manual",
  };
}
