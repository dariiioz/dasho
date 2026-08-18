"use client";

import { Check, ExternalLink, HeartPulse, Link2, X } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Folder, ServiceDraft } from "@/lib/dashboard-types";

export function ServiceEditor({
  draft,
  folders,
  saving,
  onDraftChange,
  onClose,
  onSave,
}: {
  draft: ServiceDraft | null;
  folders: Folder[];
  saving: boolean;
  onDraftChange: (draft: ServiceDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const urlInvalid = Boolean(draft?.url && !URL.canParse(draft.url));
  const canSave = Boolean(draft?.name.trim() && draft?.url && !urlInvalid && !saving);
  const editing = Boolean(draft?.id);
  const patch = (value: Partial<ServiceDraft>) => {
    if (draft) onDraftChange({ ...draft, ...value });
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/35 px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Link2 /></span>
            {editing ? "Modifier le lien" : "Ajouter un lien"}
          </DialogTitle>
          <DialogDescription>{editing ? "Modifiez les informations, l’icône ou le comportement de ce raccourci." : "Ajoutez les informations essentielles, puis Dasho récupérera l’icône automatiquement."}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) onSave();
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <FieldSet>
                <FieldLegend>Informations essentielles</FieldLegend>
                <FieldDescription>Le nom et l’URL suffisent pour créer le lien.</FieldDescription>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="service-name">Nom</FieldLabel>
                    <Input id="service-name" name="name" autoComplete="off" autoFocus={!editing} value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Ex. vCenter CHB" required />
                  </Field>
                  <Field data-invalid={urlInvalid || undefined}>
                    <FieldLabel htmlFor="service-url">URL</FieldLabel>
                    <Input id="service-url" name="url" type="url" autoComplete="off" spellCheck={false} aria-invalid={urlInvalid || undefined} value={draft.url} onChange={(event) => patch({ url: event.target.value, faviconCache: null })} placeholder="https://service.local:8443/" required />
                    {urlInvalid ? <FieldError>Saisissez une URL HTTP ou HTTPS complète.</FieldError> : <FieldDescription>Les noms DNS internes et les ports personnalisés sont acceptés.</FieldDescription>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="service-description">Description <span className="font-normal text-muted-foreground">(facultatif)</span></FieldLabel>
                    <Textarea id="service-description" name="description" autoComplete="off" value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value })} placeholder="Ex. Administration VMware…" />
                  </Field>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="service-folder">Dossier</FieldLabel>
                      <Select value={draft.folderId ? String(draft.folderId) : "none"} onValueChange={(value) => patch({ folderId: value === "none" ? null : Number(value) })}>
                        <SelectTrigger id="service-folder" className="w-full"><SelectValue placeholder="Choisir un dossier" /></SelectTrigger>
                        <SelectContent><SelectGroup><SelectLabel>Dossier</SelectLabel><SelectItem value="none">Sans dossier</SelectItem>{folders.map((folder) => <SelectItem key={folder.id} value={String(folder.id)}>{folder.name}</SelectItem>)}</SelectGroup></SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="service-tags">Tags</FieldLabel>
                      <Input id="service-tags" name="tags" autoComplete="off" value={draft.tagsText} onChange={(event) => patch({ tagsText: event.target.value })} placeholder="infra, vmware…" />
                      <FieldDescription>Séparez-les par des virgules.</FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="mt-6 rounded-xl border bg-muted/25 p-4">
                <FieldLegend>Icône</FieldLegend>
                <FieldDescription>Automatique par défaut ; choisissez une icône si nécessaire.</FieldDescription>
                <IconPicker draft={draft} onChange={patch} />
              </FieldSet>

              <FieldSet className="mt-6">
                <FieldLegend>Comportement</FieldLegend>
                <FieldGroup className="gap-3">
                  <Field orientation="horizontal" className="rounded-lg border p-3">
                    <Switch id="open-new-tab" checked={draft.openInNewTab ?? true} onCheckedChange={(checked) => patch({ openInNewTab: checked })} />
                    <FieldContent><FieldLabel htmlFor="open-new-tab" className="items-center"><ExternalLink aria-hidden="true" />Ouvrir dans un nouvel onglet</FieldLabel><FieldDescription>Conserve le dashboard ouvert.</FieldDescription></FieldContent>
                  </Field>
                  <Field orientation="horizontal" className="rounded-lg border p-3">
                    <Switch id="status-check" checked={draft.statusCheckEnabled ?? false} onCheckedChange={(checked) => patch({ statusCheckEnabled: checked })} />
                    <FieldContent><FieldLabel htmlFor="status-check" className="items-center"><HeartPulse aria-hidden="true" />Contrôler la disponibilité</FieldLabel><FieldDescription>Affiche l’état du service sur sa carte.</FieldDescription></FieldContent>
                  </Field>
                  {draft.statusCheckEnabled ? (
                    <Field>
                      <FieldLabel htmlFor="status-url">URL de contrôle facultative</FieldLabel>
                      <Input id="status-url" name="statusUrl" type="url" autoComplete="off" spellCheck={false} value={draft.statusUrl ?? ""} onChange={(event) => patch({ statusUrl: event.target.value || null })} placeholder={draft.url || "https://service.local/health"} />
                      <FieldDescription>L’URL principale est utilisée si ce champ reste vide.</FieldDescription>
                    </Field>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </div>
            <DialogFooter className="mx-0 mb-0 rounded-none px-6 py-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}><X data-icon="inline-start" />Annuler</Button>
              <Button type="submit" disabled={!canSave}>
                {saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                {saving ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Créer le lien"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
