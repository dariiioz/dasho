"use client";

import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Folder } from "@/lib/dashboard-types";

export type FolderDraft = Partial<Folder> & { name: string };

export function FolderEditor({
  draft,
  saving,
  onDraftChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: FolderDraft | null;
  saving: boolean;
  onDraftChange: (draft: FolderDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (folder: Folder) => void;
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Modifier le dossier" : "Nouveau dossier"}</DialogTitle>
          <DialogDescription>Le nom, la couleur et l’icône permettent de retrouver rapidement une section.</DialogDescription>
        </DialogHeader>
        {draft ? (
          <form className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave(); }}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="folder-name">Nom</FieldLabel><Input id="folder-name" name="folderName" autoComplete="off" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} placeholder="Ex. Infrastructure" required /></Field>
              <Field><FieldLabel htmlFor="folder-icon">Icône ou emoji</FieldLabel><Input id="folder-icon" name="folderIcon" autoComplete="off" value={draft.icon ?? ""} onChange={(event) => onDraftChange({ ...draft, icon: event.target.value || null })} placeholder="Ex. 🖥️" /></Field>
              <Field><FieldLabel htmlFor="folder-color">Couleur</FieldLabel><div className="flex items-center gap-2"><Input id="folder-color" name="folderColor" type="color" value={draft.color ?? "#7c3aed"} onChange={(event) => onDraftChange({ ...draft, color: event.target.value })} className="w-16 p-1" /><Input aria-label="Valeur hexadécimale de la couleur" name="folderColorHex" autoComplete="off" value={draft.color ?? "#7c3aed"} onChange={(event) => onDraftChange({ ...draft, color: event.target.value })} /></div><FieldDescription>La couleur est utilisée comme repère discret dans le titre du dossier.</FieldDescription></Field>
            </FieldGroup>
            <div className="flex items-center justify-between gap-2">
              {draft.id ? <Button type="button" variant="destructive" onClick={() => onDelete(draft as Folder)}><Trash2 data-icon="inline-start" />Supprimer</Button> : <span />}
              <div className="flex gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}><X data-icon="inline-start" />Annuler</Button><Button type="submit" disabled={saving || !draft.name.trim()}>{saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
