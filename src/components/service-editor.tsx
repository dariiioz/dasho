"use client";

import { Check, ExternalLink, HeartPulse, X } from "lucide-react";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
  const patch = (value: Partial<ServiceDraft>) => {
    if (draft) onDraftChange({ ...draft, ...value });
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Modifier le service" : "Ajouter un service"}</DialogTitle>
          <DialogDescription>Configurez le lien, son classement, son icône et son contrôle d’état.</DialogDescription>
        </DialogHeader>
        {draft ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) onSave();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="service-name">Nom</FieldLabel>
                <Input id="service-name" name="name" autoComplete="off" value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Ex. vCenter CHB" required />
              </Field>
              <Field data-invalid={urlInvalid || undefined}>
                <FieldLabel htmlFor="service-url">URL</FieldLabel>
                <Input id="service-url" name="url" type="url" autoComplete="off" spellCheck={false} aria-invalid={urlInvalid || undefined} value={draft.url} onChange={(event) => patch({ url: event.target.value, faviconCache: null })} placeholder="https://service.local:8443/" required />
                {urlInvalid ? <FieldError>Saisissez une URL HTTP ou HTTPS complète.</FieldError> : <FieldDescription>Les noms DNS internes et les ports personnalisés sont acceptés.</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel htmlFor="service-description">Description</FieldLabel>
                <Input id="service-description" name="description" autoComplete="off" value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value })} placeholder="Ex. Administration VMware…" />
              </Field>
              <Field>
                <FieldLabel htmlFor="service-tags">Tags</FieldLabel>
                <Input id="service-tags" name="tags" autoComplete="off" value={draft.tagsText} onChange={(event) => patch({ tagsText: event.target.value })} placeholder="Ex. infra, vmware, production…" />
                <FieldDescription>Séparez les tags par des virgules.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="service-folder">Dossier</FieldLabel>
                <Select value={draft.folderId ? String(draft.folderId) : "none"} onValueChange={(value) => patch({ folderId: value === "none" ? null : Number(value) })}>
                  <SelectTrigger id="service-folder" className="w-full"><SelectValue placeholder="Choisir un dossier" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Dossier</SelectLabel>
                      <SelectItem value="none">Sans dossier</SelectItem>
                      {folders.map((folder) => <SelectItem key={folder.id} value={String(folder.id)}>{folder.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <FieldSet>
              <FieldLegend>Icône</FieldLegend>
              <IconPicker draft={draft} onChange={patch} />
            </FieldSet>

            <FieldGroup>
              <Field orientation="horizontal">
                <Switch id="open-new-tab" checked={draft.openInNewTab ?? true} onCheckedChange={(checked) => patch({ openInNewTab: checked })} />
                <div className="flex flex-1 items-center gap-2">
                  <FieldLabel htmlFor="open-new-tab">Ouvrir dans un nouvel onglet</FieldLabel>
                  <ExternalLink aria-hidden="true" className="size-4 text-muted-foreground" />
                </div>
              </Field>
              <Field orientation="horizontal">
                <Switch id="status-check" checked={draft.statusCheckEnabled ?? false} onCheckedChange={(checked) => patch({ statusCheckEnabled: checked })} />
                <div className="flex flex-1 items-center gap-2">
                  <FieldLabel htmlFor="status-check">Contrôler la disponibilité</FieldLabel>
                  <HeartPulse aria-hidden="true" className="size-4 text-muted-foreground" />
                </div>
              </Field>
              {draft.statusCheckEnabled ? (
                <Field>
                  <FieldLabel htmlFor="status-url">URL de contrôle facultative</FieldLabel>
                  <Input id="status-url" name="statusUrl" type="url" autoComplete="off" spellCheck={false} value={draft.statusUrl ?? ""} onChange={(event) => patch({ statusUrl: event.target.value || null })} placeholder={draft.url || "https://service.local/health"} />
                  <FieldDescription>L’URL principale est utilisée si ce champ reste vide.</FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}><X data-icon="inline-start" />Annuler</Button>
              <Button type="submit" disabled={!canSave}>
                {saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                {saving ? "Enregistrement…" : "Enregistrer le service"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
