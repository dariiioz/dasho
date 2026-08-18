"use client";

import { useEffect, useState } from "react";
import { Download, Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseDashboardSettings, type DashboardSettings } from "@/lib/dashboard-settings";

type SettingsDraft = DashboardSettings;

export function SettingsDialog({
  open,
  settings,
  saving,
  importing,
  onOpenChange,
  onSave,
  onImport,
}: {
  open: boolean;
  settings: Record<string, string>;
  saving: boolean;
  importing: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (settings: SettingsDraft) => void;
  onImport: (content: string, format: "json" | "dashy") => void;
}) {
  const [draft, setDraft] = useState(() => parseDashboardSettings(settings));
  useEffect(() => {
    if (open) setDraft(parseDashboardSettings(settings));
  }, [open, settings]);
  const patch = (value: Partial<SettingsDraft>) => setDraft((current) => ({ ...current, ...value }));

  const importFile = async (file: File) => {
    const extension = file.name.toLocaleLowerCase();
    const format = extension.endsWith(".json") ? "json" : "dashy";
    onImport(await file.text(), format);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Réglages du dashboard</DialogTitle>
          <DialogDescription>Personnalisez l’affichage, les contrôles d’état et les données.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="appearance">
          <TabsList className="w-full">
            <TabsTrigger value="appearance">Apparence</TabsTrigger>
            <TabsTrigger value="behavior">Comportement</TabsTrigger>
            <TabsTrigger value="data">Données</TabsTrigger>
          </TabsList>
          <TabsContent value="appearance" className="pt-4">
            <FieldGroup>
              <Field><FieldLabel htmlFor="dashboard-title">Titre</FieldLabel><Input id="dashboard-title" name="title" autoComplete="off" value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></Field>
              <Field><FieldLabel htmlFor="theme-select">Thème</FieldLabel><Select value={draft.theme} onValueChange={(value) => patch({ theme: value as SettingsDraft["theme"] })}><SelectTrigger id="theme-select" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Thème</SelectLabel><SelectItem value="system">Système</SelectItem><SelectItem value="light">Clair</SelectItem><SelectItem value="dark">Sombre</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel htmlFor="accent-select">Couleur d’accent</FieldLabel><Select value={draft.accent} onValueChange={(value) => patch({ accent: value as SettingsDraft["accent"] })}><SelectTrigger id="accent-select" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Accent</SelectLabel><SelectItem value="violet">Violet</SelectItem><SelectItem value="blue">Bleu</SelectItem><SelectItem value="emerald">Émeraude</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel htmlFor="card-size-select">Taille des liens</FieldLabel><Select value={draft.cardSize} onValueChange={(value) => patch({ cardSize: value as SettingsDraft["cardSize"] })}><SelectTrigger id="card-size-select" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Densité</SelectLabel><SelectItem value="compact">Compacte</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="large">Large</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel htmlFor="columns">Colonnes maximales</FieldLabel><Input id="columns" name="columns" type="number" min={1} max={8} value={draft.columns} onChange={(event) => patch({ columns: Number(event.target.value) })} /></Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="behavior" className="pt-4">
            <FieldGroup>
              <Field><FieldLabel htmlFor="status-interval">Intervalle des contrôles</FieldLabel><Input id="status-interval" name="statusInterval" type="number" min={0} max={3600} value={draft.statusCheckInterval} onChange={(event) => patch({ statusCheckInterval: Number(event.target.value) })} /><FieldDescription>En secondes. Utilisez 0 pour désactiver le polling global.</FieldDescription></Field>
              <Field orientation="horizontal"><Switch id="search-on-load" checked={draft.showSearchOnLoad} onCheckedChange={(checked) => patch({ showSearchOnLoad: checked })} /><FieldLabel htmlFor="search-on-load">Ouvrir la recherche au démarrage</FieldLabel></Field>
              <Field orientation="horizontal"><Switch id="external-favicon" checked={draft.enableExternalFaviconService} onCheckedChange={(checked) => patch({ enableExternalFaviconService: checked })} /><FieldLabel htmlFor="external-favicon">Autoriser le service favicon externe</FieldLabel></Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="data" className="pt-4">
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Exporter</FieldLegend>
                <FieldDescription>Téléchargez les dossiers, services et réglages dans un fichier JSON.</FieldDescription>
                <Button variant="outline" render={<a href="/api/export" download />}><Download data-icon="inline-start" />Exporter la configuration</Button>
              </FieldSet>
              <FieldSet>
                <FieldLegend>Importer</FieldLegend>
                <FieldDescription>Les fichiers JSON Dasho et YAML Dashy sont ajoutés à la configuration existante.</FieldDescription>
                <Field><FieldLabel htmlFor="config-import"><Upload aria-hidden="true" />Fichier de configuration</FieldLabel><Input id="config-import" name="configImport" type="file" accept=".json,.yml,.yaml,application/json,text/yaml" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} /></Field>
                {importing ? <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><Spinner />Import en cours…</p> : null}
              </FieldSet>
            </FieldGroup>
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button disabled={saving || !draft.title.trim()} onClick={() => onSave(draft)}>{saving ? <Spinner data-icon="inline-start" /> : <Settings data-icon="inline-start" />}{saving ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
