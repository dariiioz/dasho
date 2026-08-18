"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, RefreshCw, Search, Smile, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceIcon } from "@/components/service-icon";
import type { ServiceDraft } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

type SimpleIconResult = { title: string; slug: string; hex: string; path: string };

const lucideIcons = [
  "activity",
  "archive",
  "bell",
  "box",
  "cloud",
  "database",
  "file-server",
  "folder-cog",
  "globe",
  "hard-drive",
  "house",
  "key-round",
  "monitor",
  "network",
  "radio-tower",
  "router",
  "server",
  "settings",
  "shield",
  "terminal",
] as const;

function tabForIconType(iconType: ServiceDraft["iconType"]) {
  if (iconType === "simple-icon") return "simple";
  if (iconType === "lucide") return "lucide";
  if (iconType === "url" || iconType === "emoji") return "custom";
  return "auto";
}

export function IconPicker({
  draft,
  onChange,
}: {
  draft: ServiceDraft;
  onChange: (patch: Partial<ServiceDraft>) => void;
}) {
  const [simpleSearch, setSimpleSearch] = useState("");
  const [previewPending, setPreviewPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const { data: simpleIcons, isLoading: simpleLoading } = useQuery({
    queryKey: ["simple-icons", simpleSearch],
    queryFn: async () => {
      const response = await fetch(`/api/icons/simple?q=${encodeURIComponent(simpleSearch)}`);
      if (!response.ok) throw new Error("Chargement impossible");
      return response.json() as Promise<SimpleIconResult[]>;
    },
    staleTime: 60 * 60 * 1_000,
  });

  useEffect(() => {
    if (draft.iconType !== "favicon" || !URL.canParse(draft.url)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewPending(true);
      setPreviewError(null);
      try {
        const response = await fetch("/api/favicon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: draft.url, name: draft.name }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Icône introuvable");
        const result = (await response.json()) as { cachePath: string | null; monogram: string | null };
        onChangeRef.current({ faviconCache: result.cachePath, iconValue: result.monogram });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPreviewError("Aucune icône distante trouvée.");
      } finally {
        if (!controller.signal.aborted) setPreviewPending(false);
      }
    }, 600);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft.iconType, draft.name, draft.url, retry]);

  const upload = async (file: File) => {
    setUploadPending(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/icon/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Upload impossible");
      const result = (await response.json()) as { cachePath: string };
      onChange({ iconType: "url", iconValue: result.cachePath, faviconCache: result.cachePath });
    } finally {
      setUploadPending(false);
    }
  };

  return (
    <Tabs
      value={tabForIconType(draft.iconType)}
      onValueChange={(value) => {
        if (value === "auto") onChange({ iconType: "favicon", faviconCache: null });
        if (value === "simple") onChange({ iconType: "simple-icon", faviconCache: null });
        if (value === "lucide") onChange({ iconType: "lucide", faviconCache: null });
        if (value === "custom") onChange({ iconType: "emoji", faviconCache: null });
      }}
    >
      <TabsList className="w-full">
        <TabsTrigger value="auto"><Sparkles data-icon="inline-start" />Auto</TabsTrigger>
        <TabsTrigger value="simple">Marques</TabsTrigger>
        <TabsTrigger value="lucide">Lucide</TabsTrigger>
        <TabsTrigger value="custom">Perso</TabsTrigger>
      </TabsList>

      <TabsContent value="auto" className="pt-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          {previewPending ? <Skeleton className="size-10 rounded-lg" /> : <ServiceIcon service={{ name: draft.name || "Service", iconType: draft.iconType ?? "favicon", iconValue: draft.iconValue ?? null, faviconCache: draft.faviconCache ?? null }} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Aperçu automatique</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {previewPending ? "Recherche de l’icône…" : previewError ?? "Icône mise en cache localement."}
            </p>
          </div>
          <Button type="button" size="icon-sm" variant="outline" aria-label="Réessayer" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw />
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="simple" className="pt-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="simple-icon-search">Rechercher une marque</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="simple-icon-search" name="simpleIconSearch" autoComplete="off" value={simpleSearch} onChange={(event) => setSimpleSearch(event.target.value)} placeholder="Ex. Proxmox, Grafana…" className="pl-9" />
            </div>
          </Field>
          <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto pr-1 sm:grid-cols-6 [content-visibility:auto]">
            {simpleLoading ? Array.from({ length: 18 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />) : simpleIcons?.map((icon) => (
              <Button key={icon.slug} type="button" variant={draft.iconValue === icon.slug ? "secondary" : "ghost"} className="h-16 min-w-0 flex-col gap-1 px-1" onClick={() => onChange({ iconType: "simple-icon", iconValue: icon.slug, faviconCache: null })}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill={`#${icon.hex}`}><path d={icon.path} /></svg>
                <span className="w-full truncate text-[10px]">{icon.title}</span>
              </Button>
            ))}
          </div>
        </FieldGroup>
      </TabsContent>

      <TabsContent value="lucide" className="pt-3">
        <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-5">
          {lucideIcons.map((icon) => (
            <Button key={icon} type="button" variant={draft.iconValue === icon ? "secondary" : "ghost"} className="h-14 min-w-0 flex-col gap-1 px-1" onClick={() => onChange({ iconType: "lucide", iconValue: icon, faviconCache: null })}>
              <ServiceIcon compact service={{ name: draft.name || "Service", iconType: "lucide", iconValue: icon, faviconCache: null }} />
              <span className="w-full truncate text-[10px]">{icon}</span>
            </Button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="custom" className="pt-3">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="custom-emoji"><Smile aria-hidden="true" />Emoji</FieldLabel>
            <Input id="custom-emoji" name="emoji" autoComplete="off" value={draft.iconType === "emoji" ? draft.iconValue ?? "" : ""} onChange={(event) => onChange({ iconType: "emoji", iconValue: event.target.value.slice(0, 8), faviconCache: null })} placeholder="Ex. 🖥️" />
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-icon-url"><ImageIcon aria-hidden="true" />URL d’image</FieldLabel>
            <Input id="custom-icon-url" name="iconUrl" type="url" autoComplete="off" spellCheck={false} value={draft.iconType === "url" && draft.iconValue?.startsWith("http") ? draft.iconValue : ""} onChange={(event) => onChange({ iconType: "url", iconValue: event.target.value, faviconCache: null })} placeholder="https://exemple.local/logo.png" />
            <FieldDescription>L’image sera téléchargée dans le cache local.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="custom-icon-file"><Upload aria-hidden="true" />Fichier local</FieldLabel>
            <Input id="custom-icon-file" name="iconFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" disabled={uploadPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <FieldDescription className={cn(uploadPending && "flex items-center gap-2")}>
              {uploadPending ? <><Spinner />Envoi du fichier…</> : "PNG, JPEG, WebP, SVG ou ICO — 2 Mo maximum."}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </TabsContent>
    </Tabs>
  );
}
