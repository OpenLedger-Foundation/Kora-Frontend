"use client";

import { useState } from "react";
import { Check, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilterState, SavedMarketplacePreset, SortState } from "@/store/invoiceStore";

interface ActiveFilterChipsProps {
  filters: FilterState;
  sort: SortState;
  presets: SavedMarketplacePreset[];
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function ActiveFilterChips({
  filters,
  sort,
  presets,
  onSave,
  onLoad,
  onRename,
  onDelete,
}: ActiveFilterChipsProps) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const activeCount = filters.categories.length + filters.jurisdictions.length + filters.riskTiers.length +
    (filters.aprRange[0] > 0 || filters.aprRange[1] < 50 ? 1 : 0) + (filters.activeOnly ? 1 : 0);

  const save = () => {
    if (!name.trim()) return;
    onSave(name);
    setName("");
  };

  const rename = (id: string) => {
    if (editingName.trim()) onRename(id, editingName);
    setEditingId(null);
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Saved marketplace presets">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Presets</span>
        {presets.map((preset) => (
          <div key={preset.id} className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 pl-2.5 pr-1 py-1">
            {editingId === preset.id ? (
              <Input
                autoFocus
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") rename(preset.id); if (event.key === "Escape") setEditingId(null); }}
                className="h-6 w-28 border-zinc-700 bg-zinc-950 px-1.5 text-xs"
                aria-label={`Rename ${preset.name}`}
              />
            ) : (
              <button type="button" onClick={() => onLoad(preset.id)} className="max-w-36 truncate text-xs font-medium text-zinc-200 hover:text-primary" title={`Load ${preset.name}`}>
                {preset.name}
              </button>
            )}
            {editingId === preset.id ? (
              <button type="button" onClick={() => rename(preset.id)} className="p-1 text-primary hover:text-primary/80" aria-label="Save preset name"><Check className="h-3.5 w-3.5" /></button>
            ) : (
              <>
                <button type="button" onClick={() => { setEditingId(preset.id); setEditingName(preset.name); }} className="p-1 text-zinc-500 hover:text-zinc-200" aria-label={`Rename ${preset.name}`}><Pencil className="h-3 w-3" /></button>
                <button type="button" onClick={() => onDelete(preset.id)} className="p-1 text-zinc-500 hover:text-red-400" aria-label={`Delete ${preset.name}`}><Trash2 className="h-3 w-3" /></button>
              </>
            )}
          </div>
        ))}
        {presets.length === 0 && <span className="text-xs text-zinc-600">No saved searches</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") save(); }}
          placeholder={activeCount > 0 ? "Name current filters" : "Name search"}
          aria-label="New preset name"
          className="h-9 w-40 border-zinc-800 bg-zinc-950/60 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={save} disabled={!name.trim()} leftIcon={<Save className="h-3.5 w-3.5" />}>
          Save
        </Button>
      </div>
    </section>
  );
}
