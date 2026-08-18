"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Command as CommandIcon,
  Copy,
  FolderCog,
  FolderPlus,
  GripVertical,
  LayoutGrid,
  List,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  Sun,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteFolder,
  deleteService,
  duplicateService,
  importConfiguration,
  refreshServiceIcon,
  reorderFolders,
  reorderServices,
  restoreService,
  saveFolder,
  saveService,
  saveSettings,
  toggleServiceFavorite,
} from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FolderDraft } from "@/components/folder-editor";
import { ServiceIcon } from "@/components/service-icon";
import type { DashboardData, Folder, Service, ServiceDraft, ServiceStatus } from "@/lib/dashboard-types";
import { parseDashboardSettings, type DashboardSettings } from "@/lib/dashboard-settings";
import { cn } from "@/lib/utils";

const ServiceEditor = dynamic(() => import("@/components/service-editor").then((module) => module.ServiceEditor), { ssr: false });
const FolderEditor = dynamic(() => import("@/components/folder-editor").then((module) => module.FolderEditor), { ssr: false });
const SettingsDialog = dynamic(() => import("@/components/settings-dialog").then((module) => module.SettingsDialog), { ssr: false });
type SettingsDraft = DashboardSettings;

const emptyDraft: ServiceDraft = {
  name: "",
  url: "",
  tagsText: "",
  iconType: "favicon",
  iconValue: null,
  faviconCache: null,
  folderId: null,
  openInNewTab: true,
  statusCheckEnabled: false,
  statusUrl: null,
};

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("Chargement impossible");
  return response.json() as Promise<DashboardData>;
}

async function fetchStatus(id: number) {
  const response = await fetch(`/api/status/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error("État indisponible");
  return response.json() as Promise<ServiceStatus>;
}

function sortServices(items: Service[], mode: SettingsDraft["sortMode"]) {
  return [...items].sort((left, right) => {
    if (mode === "alphabetical") return left.name.localeCompare(right.name, "fr", { sensitivity: "base" });
    if (mode === "recent") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (mode === "popular") return right.clickCount - left.clickCount || left.position - right.position;
    return left.position - right.position;
  });
}

function isEmojiIcon(value: string) {
  return /\p{Extended_Pictographic}/u.test(value);
}

function StatusIndicator({ value }: { value: ServiceStatus | undefined }) {
  const status = value?.status ?? "unknown";
  const label = status === "up" ? "Disponible" : status === "down" ? "Indisponible" : "État inconnu";
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("size-2 rounded-full ring-2 ring-background", status === "up" && "bg-primary", status === "down" && "bg-destructive", status === "unknown" && "bg-muted-foreground/40")} role="status" aria-label={label} />} />
      <TooltipContent>{label}{value?.responseTime !== null && value?.responseTime !== undefined ? ` · ${value.responseTime} ms` : ""}</TooltipContent>
    </Tooltip>
  );
}

type ServiceActions = {
  edit: (service: Service) => void;
  duplicate: (service: Service) => void;
  refreshIcon: (service: Service) => void;
  toggleFavorite: (service: Service) => void;
  trackOpen: (service: Service) => void;
  remove: (service: Service) => void;
};

function FolderDropZone({ folderId, folderName }: { folderId: number | null; folderName: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: `folder-drop-${folderId ?? "null"}`, data: { type: "folder-drop", folderId } });
  return (
    <div ref={setNodeRef} className={cn("mt-2 flex min-h-14 w-full items-center justify-center rounded-lg border border-dashed border-border/80 px-3 text-xs text-muted-foreground transition-[background-color,border-color,color]", isOver && "border-primary bg-primary/10 text-primary")}>
      {isOver ? `Déposer dans « ${folderName} »` : "Déposer ici"}
    </div>
  );
}

const ServiceTile = memo(function ServiceTile({
  service,
  editing,
  sortable,
  viewMode,
  cardSize,
  status,
  actions,
  sortableId,
}: {
  service: Service;
  editing: boolean;
  sortable: boolean;
  viewMode: "grid" | "list";
  cardSize: SettingsDraft["cardSize"];
  status: ServiceStatus | undefined;
  actions: ServiceActions;
  sortableId: string;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: sortableId,
    data: { type: "service", service },
    disabled: !sortable,
  });
  const domain = useMemo(() => new URL(service.url).hostname, [service.url]);
  const list = viewMode === "list";
  return (
    <Card ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("group relative min-w-0 gap-0 overflow-hidden rounded-xl border-border/90 bg-card py-0 shadow-none transition-[border-color,background-color] duration-150 ease-out hover:border-service-hover-border hover:bg-service-hover focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/25", isDragging && "opacity-45", isOver && "border-primary bg-primary/10", list && "rounded-lg")}>
      <a href={service.url} target={service.openInNewTab ? "_blank" : undefined} rel="noreferrer" aria-label={`Ouvrir ${service.name}`} onClick={() => actions.trackOpen(service)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <CardContent className={cn("flex items-center gap-2.5", sortable ? "pr-17" : "pr-11", list ? "min-h-11 px-2.5 py-1.5" : cardSize === "large" ? "min-h-20 px-4 py-3" : cardSize === "medium" ? "min-h-17 px-3 py-2.5" : "min-h-15 px-3 py-2.5")}>
          <ServiceIcon service={service} compact={list} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-5 tracking-[-0.01em]">{service.name}</p>
            <p className={cn("truncate text-[11px] leading-4 text-muted-foreground", list && "hidden sm:block")}>{service.description || domain}</p>
          </div>
          {list ? <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:block">{domain}</span> : null}
          {service.favorite ? <Star className="size-3.5 shrink-0 fill-primary text-primary" aria-label="Favori" /> : null}
          {service.statusCheckEnabled ? <StatusIndicator value={status} /> : null}
        </CardContent>
      </a>
      <div className={cn("absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded-md border border-border/80 bg-card p-0.5 shadow-sm", !editing && "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100")}>
        {sortable ? (
          <Button ref={setActivatorNodeRef} type="button" size="icon-sm" variant="ghost" aria-label={`Déplacer ${service.name}`} {...attributes} {...listeners}>
            <GripVertical />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={`Actions pour ${service.name}`} />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => actions.edit(service)}><Pencil />Modifier</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.duplicate(service)}><Copy />Dupliquer</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.toggleFavorite(service)}><Star className={cn(service.favorite && "fill-current")} />{service.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.refreshIcon(service)}><RefreshCw />Rafraîchir l’icône</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup><DropdownMenuItem variant="destructive" onClick={() => actions.remove(service)}><Trash2 />Supprimer</DropdownMenuItem></DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
});

function ServiceGrid({ services, editing, sortable, viewMode, cardSize, statuses, actions, columns, idPrefix = "service" }: { services: Service[]; editing: boolean; sortable: boolean; viewMode: "grid" | "list"; cardSize: SettingsDraft["cardSize"]; statuses: Map<number, ServiceStatus | undefined>; actions: ServiceActions; columns: number; idPrefix?: string }) {
  const minimum = cardSize === "large" ? 230 : cardSize === "medium" ? 190 : 165;
  return (
    <SortableContext items={services.map((service) => `${idPrefix}-${service.id}`)} strategy={viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy}>
      <div className={cn("grid gap-2 [content-visibility:auto]", viewMode === "list" && "grid-cols-1")} style={viewMode === "grid" ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, max(${minimum}px, ${Math.floor(1280 / columns)}px)), 1fr))` } : undefined}>
        {services.map((service) => <ServiceTile key={service.id} service={service} editing={editing} sortable={sortable} viewMode={viewMode} cardSize={cardSize} status={statuses.get(service.id)} actions={actions} sortableId={`${idPrefix}-${service.id}`} />)}
      </div>
    </SortableContext>
  );
}

function FolderSection({ folder, services, editing, sortable, viewMode, cardSize, statuses, actions, columns, draggingService, onEdit, onToggle }: { folder: Folder; services: Service[]; editing: boolean; sortable: boolean; viewMode: "grid" | "list"; cardSize: SettingsDraft["cardSize"]; statuses: Map<number, ServiceStatus | undefined>; actions: ServiceActions; columns: number; draggingService: boolean; onEdit: (folder: Folder) => void; onToggle: (folder: Folder, open: boolean) => void }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: `folder-${folder.id}`, data: { type: "folder", folder }, disabled: !sortable || draggingService });
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("mb-6 scroll-mt-20 rounded-lg [content-visibility:auto]", isDragging && "opacity-45", draggingService && isOver && "bg-primary/5 ring-1 ring-primary/30")} aria-labelledby={`folder-${folder.id}-title`}>
      <div className="mb-2.5 flex min-h-7 items-center gap-1 px-0.5">
        {sortable ? <Button ref={setActivatorNodeRef} size="icon-xs" variant="ghost" aria-label={`Déplacer le dossier ${folder.name}`} {...attributes} {...listeners}><GripVertical /></Button> : null}
        <Button size="icon-xs" variant="ghost" aria-label={folder.collapsed ? `Déplier ${folder.name}` : `Replier ${folder.name}`} onClick={() => onToggle(folder, folder.collapsed)}>{folder.collapsed ? <ChevronRight /> : <ChevronDown />}</Button>
        <span className="size-2 rounded-full" style={{ backgroundColor: folder.color ?? "var(--primary)" }} />
        {folder.icon ? isEmojiIcon(folder.icon) ? <span aria-hidden="true" className="text-sm">{folder.icon}</span> : <DynamicIcon name={folder.icon.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() as IconName} aria-hidden="true" className="size-3.5 text-muted-foreground" /> : null}
        <h2 id={`folder-${folder.id}-title`} className="truncate text-[12px] font-bold uppercase tracking-[0.08em] text-foreground/75">{folder.name}</h2>
        <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">{services.length}</Badge>
        {editing ? <Button size="icon-xs" variant="ghost" aria-label={`Modifier le dossier ${folder.name}`} onClick={() => onEdit(folder)}><FolderCog /></Button> : null}
      </div>
      {!folder.collapsed ? <ServiceGrid services={services} editing={editing} sortable={sortable} viewMode={viewMode} cardSize={cardSize} statuses={statuses} actions={actions} columns={columns} /> : null}
      {draggingService ? <FolderDropZone folderId={folder.id} folderName={folder.name} /> : null}
    </section>
  );
}

function LoadingDashboard() {
  return <main className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8"><div className="mb-8 flex items-center gap-4"><Skeleton className="size-10 rounded-xl" /><div className="flex flex-col gap-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-48" /></div></div><div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-2">{Array.from({ length: 18 }, (_, index) => <Skeleton key={index} className="h-15 rounded-xl" />)}</div></main>;
}

function PixelAtmosphere() {
  return (
    <div className="dasho-atmosphere" aria-hidden="true">
      <span className="dasho-atmosphere__glow" />
      <span className="dasho-atmosphere__pixels dasho-atmosphere__pixels--far" />
      <span className="dasho-atmosphere__pixels dasho-atmosphere__pixels--near" />
    </div>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [editing, setEditing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft | null>(null);
  const [folderDraft, setFolderDraft] = useState<FolderDraft | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [draggingService, setDraggingService] = useState(false);
  const openedSearchOnLoad = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const parsedSettings = useMemo(() => parseDashboardSettings(data?.settings ?? {}), [data?.settings]);
  const statusServices = useMemo(() => data?.services.filter((service) => service.statusCheckEnabled) ?? [], [data?.services]);
  const statusQueries = useQueries({ queries: statusServices.map((service) => ({ queryKey: ["status", service.id], queryFn: () => fetchStatus(service.id), refetchInterval: parsedSettings.statusCheckInterval > 0 ? parsedSettings.statusCheckInterval * 1_000 : false, refetchIntervalInBackground: false, staleTime: Math.max(parsedSettings.statusCheckInterval * 500, 1_000) })) });
  const statuses = useMemo(() => new Map(statusServices.map((service, index) => [service.id, statusQueries[index]?.data])), [statusQueries, statusServices]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const saveServiceMutation = useMutation({ mutationFn: saveService, onSuccess: () => { toast.success("Service enregistré"); setServiceDraft(null); void refresh(); }, onError: (cause) => toast.error(cause instanceof Error ? cause.message : "Enregistrement impossible.") });
  const restoreServiceMutation = useMutation({ mutationFn: restoreService, onSuccess: () => { toast.success("Service restauré"); void refresh(); }, onError: () => toast.error("Restauration impossible.") });
  const deleteServiceMutation = useMutation({ mutationFn: (service: Service) => deleteService(service.id), onSuccess: (_, service) => { setServiceToDelete(null); toast.success(`« ${service.name} » supprimé.`, { duration: 8_000, action: { label: "Annuler", onClick: () => restoreServiceMutation.mutate(service) } }); void refresh(); }, onError: () => toast.error("Suppression impossible.") });
  const duplicateMutation = useMutation({ mutationFn: duplicateService, onSuccess: () => { toast.success("Service dupliqué"); void refresh(); }, onError: () => toast.error("Duplication impossible.") });
  const refreshIconMutation = useMutation({ mutationFn: refreshServiceIcon, onSuccess: () => { toast.success("Icône actualisée"); void refresh(); }, onError: () => toast.error("L’icône n’a pas pu être récupérée.") });
  const toggleFavoriteMutation = useMutation({ mutationFn: toggleServiceFavorite, onSuccess: () => void refresh(), onError: () => { toast.error("Favori non enregistré."); void refresh(); } });
  const saveFolderMutation = useMutation({ mutationFn: saveFolder, onSuccess: () => { toast.success("Dossier enregistré"); setFolderDraft(null); void refresh(); }, onError: () => toast.error("Enregistrement du dossier impossible.") });
  const deleteFolderMutation = useMutation({ mutationFn: deleteFolder, onSuccess: () => { toast.success("Dossier supprimé — ses liens sont dans “Sans dossier”."); setFolderToDelete(null); setFolderDraft(null); void refresh(); }, onError: () => toast.error("Suppression du dossier impossible.") });
  const settingsMutation = useMutation({ mutationFn: saveSettings, onSuccess: (_, values) => { if (typeof values === "object" && values && "theme" in values && typeof values.theme === "string") setTheme(values.theme); toast.success("Réglages enregistrés"); setSettingsOpen(false); void refresh(); }, onError: () => toast.error("Enregistrement des réglages impossible.") });
  const displayMutation = useMutation({ mutationFn: saveSettings, onError: () => { toast.error("Affichage non enregistré."); void refresh(); } });
  const importMutation = useMutation({ mutationFn: ({ content, format }: { content: string; format: "json" | "dashy" }) => importConfiguration(content, format), onSuccess: (result) => { toast.success(`${result.services} services et ${result.folders} dossiers importés`); void refresh(); }, onError: (cause) => toast.error(cause instanceof Error ? cause.message : "Import impossible.") });
  const reorderServiceMutation = useMutation({ mutationFn: reorderServices, onError: () => { toast.error("Déplacement non enregistré."); void refresh(); } });
  const reorderFolderMutation = useMutation({ mutationFn: reorderFolders, onError: () => { toast.error("Ordre des dossiers non enregistré."); void refresh(); } });

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, [contenteditable=true]");
      if ((!typing && event.key === "/") || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  useEffect(() => {
    if (data && parsedSettings.showSearchOnLoad && !openedSearchOnLoad.current) {
      openedSearchOnLoad.current = true;
      setPaletteOpen(true);
    }
  }, [data, parsedSettings.showSearchOnLoad]);

  useEffect(() => {
    const missing = data?.services.find((service) => service.iconMissing);
    if (missing && !refreshIconMutation.isPending) refreshIconMutation.mutate(missing.id);
  }, [data?.services, refreshIconMutation]);

  const visibleServices = useMemo(() => {
    const normalized = deferredSearch.trim().toLocaleLowerCase("fr");
    const filtered = normalized ? (data?.services ?? []).filter((service) => `${service.name} ${service.description ?? ""} ${service.tags.join(" ")} ${service.url}`.toLocaleLowerCase("fr").includes(normalized)) : data?.services ?? [];
    return sortServices(filtered, parsedSettings.sortMode);
  }, [data?.services, deferredSearch, parsedSettings.sortMode]);

  if (isLoading) return <LoadingDashboard />;
  if (error || !data) return <main className="grid min-h-screen place-items-center p-6"><Card className="max-w-sm"><CardContent className="flex flex-col items-center gap-4 p-6 text-center"><p className="font-semibold">Impossible de charger le dashboard</p><p className="text-sm text-muted-foreground">Vérifiez la base de données puis réessayez.</p><Button onClick={() => void refresh()}>Réessayer</Button></CardContent></Card></main>;

  const actions: ServiceActions = {
    edit: (service) => setServiceDraft({ ...service, tagsText: service.tags.join(", ") }),
    duplicate: (service) => duplicateMutation.mutate(service.id),
    refreshIcon: (service) => refreshIconMutation.mutate(service.id),
    toggleFavorite: (service) => {
      queryClient.setQueryData<DashboardData>(["dashboard"], (current) => current ? { ...current, services: current.services.map((item) => item.id === service.id ? { ...item, favorite: !item.favorite } : item) } : current);
      toggleFavoriteMutation.mutate(service.id);
    },
    trackOpen: (service) => {
      queryClient.setQueryData<DashboardData>(["dashboard"], (current) => current ? { ...current, services: current.services.map((item) => item.id === service.id ? { ...item, clickCount: item.clickCount + 1 } : item) } : current);
      void fetch(`/api/services/${service.id}/open`, { method: "POST", keepalive: true }).catch(() => void refresh());
    },
    remove: setServiceToDelete,
  };
  const sortable = editing && !deferredSearch && parsedSettings.viewMode !== "tags" && parsedSettings.sortMode === "manual";

  const updateDisplay = (patch: Partial<Pick<SettingsDraft, "viewMode" | "sortMode">>) => {
    queryClient.setQueryData<DashboardData>(["dashboard"], (current) => current ? { ...current, settings: { ...current.settings, ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, String(value)])) } } : current);
    displayMutation.mutate(patch);
  };

  const toggleFolder = (folder: Folder, open: boolean) => {
    queryClient.setQueryData<DashboardData>(["dashboard"], (current) => current ? { ...current, folders: current.folders.map((item) => item.id === folder.id ? { ...item, collapsed: !open } : item) } : current);
    saveFolderMutation.mutate({ ...folder, collapsed: !open });
  };

  const onDragStart = (event: DragStartEvent) => {
    setDraggingService(event.active.data.current?.type === "service");
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingService(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (active.data.current?.type === "folder" && over.data.current?.type === "folder") {
      const oldIndex = data.folders.findIndex((folder) => `folder-${folder.id}` === active.id);
      const newIndex = data.folders.findIndex((folder) => `folder-${folder.id}` === over.id);
      const reordered = arrayMove(data.folders, oldIndex, newIndex).map((folder, position) => ({ ...folder, position }));
      queryClient.setQueryData<DashboardData>(["dashboard"], { ...data, folders: reordered });
      reorderFolderMutation.mutate(reordered.map(({ id, position }) => ({ id, position })));
      return;
    }
    if (active.data.current?.type !== "service") return;
    const activeService = active.data.current.service as Service;
    const overService = over.data.current?.type === "service" ? over.data.current.service as Service : null;
    const targetFolderId = overService?.folderId ?? (over.data.current?.type === "folder" ? (over.data.current.folder as Folder).id : over.data.current?.type === "folder-drop" ? over.data.current.folderId as number | null : activeService.folderId);
    const remaining = data.services.filter((service) => service.id !== activeService.id);
    const targetItems = remaining.filter((service) => service.folderId === targetFolderId);
    const insertionIndex = overService ? Math.max(0, targetItems.findIndex((service) => service.id === overService.id)) : targetItems.length;
    targetItems.splice(insertionIndex, 0, { ...activeService, folderId: targetFolderId });
    const targetIds = new Set(targetItems.map((service) => service.id));
    const reordered = remaining.filter((service) => !targetIds.has(service.id)).concat(targetItems.map((service, position) => ({ ...service, position })));
    queryClient.setQueryData<DashboardData>(["dashboard"], { ...data, services: reordered });
    reorderServiceMutation.mutate(reordered.map(({ id, folderId, position }) => ({ id, folderId, position })));
  };

  const renderGroupedSections = () => data.folders.map((folder) => {
    const services = visibleServices.filter((service) => service.folderId === folder.id);
    if (!services.length && deferredSearch) return null;
    return <FolderSection key={folder.id} folder={folder} services={services} editing={editing} sortable={sortable} viewMode={parsedSettings.viewMode === "list" ? "list" : "grid"} cardSize={parsedSettings.cardSize} statuses={statuses} actions={actions} columns={parsedSettings.columns} draggingService={draggingService} onEdit={(item) => setFolderDraft({ ...item })} onToggle={toggleFolder} />;
  });

  const unfiled = visibleServices.filter((service) => service.folderId === null);
  const tags = [...new Set(visibleServices.flatMap((service) => service.tags.length ? service.tags : ["Sans tag"]))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragCancel={() => setDraggingService(false)} onDragEnd={onDragEnd}>
      <div data-accent={parsedSettings.accent} data-editing={editing || undefined} className="relative isolate min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,var(--color-primary)/0.04,transparent_28rem)]">
        <PixelAtmosphere />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring">Aller au contenu</a>
        <header className={cn("sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl transition-colors", editing && "border-primary/40 bg-primary/5")}>
          <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <div className="mr-auto flex min-w-0 items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LayoutGrid className="size-4" aria-hidden="true" /></div><div className="min-w-0"><h1 className="truncate text-[15px] font-bold leading-5 tracking-[-0.02em] text-balance">{parsedSettings.title}</h1><p className="text-[11px] text-muted-foreground">{data.services.length} services · {data.folders.length} dossiers</p></div>{editing ? <Badge className="hidden gap-1.5 rounded-md sm:inline-flex"><span className="size-1.5 rounded-full bg-primary-foreground" />Mode édition actif</Badge> : null}</div>
            <Button variant="outline" size="sm" className="hidden min-w-52 justify-start text-muted-foreground lg:flex" onClick={() => setPaletteOpen(true)}><Search data-icon="inline-start" />Rechercher<CommandShortcut className="ml-auto flex items-center gap-0.5"><CommandIcon className="size-3" />K</CommandShortcut></Button>
            <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Changer le thème" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} />}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</TooltipTrigger><TooltipContent>Changer le thème</TooltipContent></Tooltip>
            <Button variant="ghost" size="icon-sm" aria-label="Ouvrir les réglages" onClick={() => setSettingsOpen(true)}><Settings /></Button>
            <Button variant={editing ? "default" : "ghost"} size="sm" onClick={() => setEditing((value) => !value)}>{editing ? <Check data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}<span className="hidden sm:inline">{editing ? "Terminer" : "Éditer"}</span></Button>
            <Button size="sm" onClick={() => setServiceDraft({ ...emptyDraft, folderId: data.folders[0]?.id ?? null })}><Plus data-icon="inline-start" /><span className="hidden sm:inline">Ajouter</span></Button>
          </div>
          <div className="mx-auto flex max-w-[1800px] items-center gap-2 px-4 pb-2 sm:px-6 lg:px-8">
            <ToggleGroup value={[parsedSettings.viewMode]} onValueChange={(values) => { const value = values.at(-1) as SettingsDraft["viewMode"] | undefined; if (value) updateDisplay({ viewMode: value }); }} variant="outline" size="sm" spacing={0} aria-label="Mode d’affichage"><ToggleGroupItem value="grid" aria-label="Grille"><LayoutGrid /></ToggleGroupItem><ToggleGroupItem value="list" aria-label="Liste"><List /></ToggleGroupItem><ToggleGroupItem value="tags" aria-label="Regrouper par tags"><Tags /></ToggleGroupItem></ToggleGroup>
            <Select value={parsedSettings.sortMode} onValueChange={(value) => updateDisplay({ sortMode: value as SettingsDraft["sortMode"] })}><SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="manual">Tri manuel</SelectItem><SelectItem value="alphabetical">Alphabétique</SelectItem><SelectItem value="recent">Ajout récent</SelectItem><SelectItem value="popular">Plus populaires</SelectItem></SelectGroup></SelectContent></Select>
            <div className="relative ml-auto w-full max-w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input name="dashboardSearch" autoComplete="off" aria-label="Filtrer les services" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrer les services…" className="h-7 pl-9" /></div>
          </div>
        </header>

        <main id="main-content" className="relative z-10 mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
          {!editing && parsedSettings.viewMode !== "tags" && visibleServices.some((service) => service.favorite) ? <section className="mb-6 scroll-mt-24"><div className="mb-2.5 flex items-center gap-2"><Star className="size-3.5 fill-primary text-primary" aria-hidden="true" /><h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground/75">Accès rapides</h2><Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">{visibleServices.filter((service) => service.favorite).length}</Badge></div><ServiceGrid services={visibleServices.filter((service) => service.favorite)} editing={false} sortable={false} viewMode={parsedSettings.viewMode === "list" ? "list" : "grid"} cardSize={parsedSettings.cardSize} statuses={statuses} actions={actions} columns={parsedSettings.columns} idPrefix="favorite-service" /></section> : null}
          {parsedSettings.viewMode === "tags" ? tags.map((tag) => { const services = visibleServices.filter((service) => tag === "Sans tag" ? !service.tags.length : service.tags.includes(tag)); return <section key={tag} className="mb-6 scroll-mt-24"><div className="mb-2.5 flex items-center gap-2"><Tags className="size-3.5 text-muted-foreground" aria-hidden="true" /><h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground/75">{tag}</h2><Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">{services.length}</Badge></div><ServiceGrid services={services} editing={editing} sortable={false} viewMode="grid" cardSize={parsedSettings.cardSize} statuses={statuses} actions={actions} columns={parsedSettings.columns} /></section>; }) : <><SortableContext items={data.folders.map((folder) => `folder-${folder.id}`)} strategy={verticalListSortingStrategy}>{renderGroupedSections()}</SortableContext><section className="mb-6 min-h-10 scroll-mt-24 rounded-lg"><div className="mb-2.5 flex items-center gap-2"><span className="size-2 rounded-full bg-muted-foreground/50" /><h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground/75">Sans dossier</h2><Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">{unfiled.length}</Badge></div>{unfiled.length ? <ServiceGrid services={unfiled} editing={editing} sortable={sortable} viewMode={parsedSettings.viewMode === "list" ? "list" : "grid"} cardSize={parsedSettings.cardSize} statuses={statuses} actions={actions} columns={parsedSettings.columns} /> : null}{draggingService ? <FolderDropZone folderId={null} folderName="Sans dossier" /> : null}</section></>}
          {!visibleServices.length ? <Empty className="min-h-52 border"><EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>Aucun service trouvé</EmptyTitle><EmptyDescription>Essayez un autre nom, tag ou domaine.</EmptyDescription></EmptyHeader></Empty> : null}
          {editing ? <Button variant="outline" size="sm" className="mt-2" onClick={() => setFolderDraft({ name: "", color: "#7c3aed", icon: null, collapsed: false })}><FolderPlus data-icon="inline-start" />Nouveau dossier</Button> : null}
        </main>

        <CommandDialog open={paletteOpen} onOpenChange={(open) => { setPaletteOpen(open); if (!open) setPaletteQuery(""); }} title="Palette de commandes" description="Rechercher un service ou lancer une action">
          <Command><CommandInput value={paletteQuery} onValueChange={setPaletteQuery} placeholder="Nom, tag, domaine ou > action…" /><CommandList><CommandEmpty>Aucun résultat.</CommandEmpty>{paletteQuery.startsWith(">") ? <CommandGroup heading="Actions"><CommandItem onSelect={() => { setServiceDraft({ ...emptyDraft, folderId: data.folders[0]?.id ?? null }); setPaletteOpen(false); }}><Plus />Ajouter un service</CommandItem><CommandItem onSelect={() => { setFolderDraft({ name: "", color: "#7c3aed", icon: null }); setPaletteOpen(false); }}><FolderPlus />Créer un dossier</CommandItem><CommandItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun />Changer de thème</CommandItem><CommandItem onSelect={() => { setSettingsOpen(true); setPaletteOpen(false); }}><Settings />Ouvrir les réglages</CommandItem></CommandGroup> : <><CommandGroup heading="Services">{data.services.map((service) => <CommandItem key={service.id} value={`${service.name} ${service.description ?? ""} ${service.tags.join(" ")} ${new URL(service.url).hostname}`} onSelect={() => { window.open(service.url, service.openInNewTab ? "_blank" : "_self"); setPaletteOpen(false); }} onKeyDown={(event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); window.open(service.url, "_blank"); setPaletteOpen(false); } }}><ServiceIcon service={service} compact /><span className="truncate font-medium">{service.name}</span><CommandShortcut>{new URL(service.url).hostname}</CommandShortcut></CommandItem>)}</CommandGroup><CommandSeparator /><CommandGroup heading="Actions"><CommandItem value="action ajouter service" onSelect={() => { setServiceDraft({ ...emptyDraft, folderId: data.folders[0]?.id ?? null }); setPaletteOpen(false); }}><Plus />Ajouter un service</CommandItem></CommandGroup></>}</CommandList></Command>
        </CommandDialog>

        <ServiceEditor draft={serviceDraft} folders={data.folders} saving={saveServiceMutation.isPending} onDraftChange={setServiceDraft} onClose={() => setServiceDraft(null)} onSave={() => { if (!serviceDraft) return; saveServiceMutation.mutate({ ...serviceDraft, tags: serviceDraft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean) }); }} />
        <FolderEditor draft={folderDraft} saving={saveFolderMutation.isPending} onDraftChange={setFolderDraft} onClose={() => setFolderDraft(null)} onSave={() => { if (folderDraft) saveFolderMutation.mutate(folderDraft); }} onDelete={(folder) => setFolderToDelete(folder)} />
        <SettingsDialog open={settingsOpen} settings={data.settings} saving={settingsMutation.isPending} importing={importMutation.isPending} onOpenChange={setSettingsOpen} onSave={(values) => settingsMutation.mutate(values)} onImport={(content, format) => importMutation.mutate({ content, format })} />

        <AlertDialog open={serviceToDelete !== null} onOpenChange={(open) => { if (!open && !deleteServiceMutation.isPending) setServiceToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogMedia className="bg-destructive/10 text-destructive"><Trash2 aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>Supprimer « {serviceToDelete?.name} » ?</AlertDialogTitle><AlertDialogDescription>Le lien disparaîtra du dashboard. Vous pourrez l’annuler pendant quelques secondes après confirmation.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteServiceMutation.isPending}>Annuler</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleteServiceMutation.isPending} onClick={() => serviceToDelete && deleteServiceMutation.mutate(serviceToDelete)}><Trash2 data-icon="inline-start" />{deleteServiceMutation.isPending ? "Suppression…" : "Supprimer le lien"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <AlertDialog open={folderToDelete !== null} onOpenChange={(open) => { if (!open && !deleteFolderMutation.isPending) setFolderToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogMedia className="bg-destructive/10 text-destructive"><Trash2 aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>Supprimer le dossier « {folderToDelete?.name} » ?</AlertDialogTitle><AlertDialogDescription>Le dossier sera supprimé, mais ses services seront conservés dans « Sans dossier ».</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteFolderMutation.isPending}>Annuler</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleteFolderMutation.isPending} onClick={() => folderToDelete && deleteFolderMutation.mutate(folderToDelete.id)}><Trash2 data-icon="inline-start" />{deleteFolderMutation.isPending ? "Suppression…" : "Supprimer le dossier"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </DndContext>
  );
}
