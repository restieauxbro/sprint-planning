"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Engineer } from "@/lib/schema";
import {
  peopleInViewSection,
  type BoardViewConfig,
  type SavedView,
  type ViewSection,
  type ViewSectionFilter,
} from "@/lib/saved-views";
import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  LayersIcon,
  PlusIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  createViewAction,
  deleteViewAction,
  setDefaultViewAction,
  updateViewAction,
} from "../actions";

type Draft = {
  id: string | null;
  name: string;
  config: BoardViewConfig;
  makeDefault: boolean;
};

export function ViewManager({
  initialViews,
  engineers,
  currentConfig,
  activeViewId,
  onApply,
  onActiveViewChange,
  onShowProjectNameChange,
}: {
  initialViews: SavedView[];
  engineers: Engineer[];
  currentConfig: BoardViewConfig;
  activeViewId: string | null;
  onApply: (config: BoardViewConfig) => void;
  onActiveViewChange: (id: string | null) => void;
  onShowProjectNameChange: (show: boolean) => void;
}) {
  const [views, setViews] = useState(initialViews);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeView = views.find((view) => view.id === activeViewId) ?? null;
  const dirty = activeView ? JSON.stringify(activeView.config) !== JSON.stringify(currentConfig) : false;

  const tags = useMemo(
    () => Array.from(new Set(engineers.flatMap((person) => (person.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean)))).sort(),
    [engineers],
  );
  const titles = useMemo(
    () => Array.from(new Set(engineers.map((person) => person.title.trim()).filter(Boolean))).sort(),
    [engineers],
  );

  function startCreate() {
    setError(null);
    setDeleteConfirm(false);
    setDraft({
      id: null,
      name: "",
      config: { ...currentConfig, sections: currentConfig.sections.map(copySection) },
      makeDefault: views.length === 0,
    });
  }

  function startEdit(view: SavedView) {
    setError(null);
    setDeleteConfirm(false);
    setDraft({
      id: view.id,
      name: view.name,
      config: { ...view.config, sections: view.config.sections.map(copySection) },
      makeDefault: view.isDefault,
    });
  }

  function applyView(view: SavedView) {
    onApply(view.config);
    onActiveViewChange(view.id);
    setDraft(null);
    setError(null);
  }

  function applyUnsavedView() {
    onApply({ ...currentConfig, sections: [] });
    onActiveViewChange(null);
    setDraft(null);
    setError(null);
  }

  function saveDraft() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      if (draft.id) {
        const result = await updateViewAction({ id: draft.id, name: draft.name, config: draft.config });
        if (!result.ok) return setError(result.error);
        setViews((current) => current.map((view) => view.id === result.view.id ? result.view : view));
        if (activeViewId === result.view.id) onApply(result.view.config);
        setDraft(null);
        return;
      }
      const result = await createViewAction({
        name: draft.name,
        config: draft.config,
        makeDefault: draft.makeDefault,
      });
      if (!result.ok) return setError(result.error);
      setViews((current) => [
        result.view,
        ...current.map((view) => draft.makeDefault ? { ...view, isDefault: false } : view),
      ]);
      onApply(result.view.config);
      onActiveViewChange(result.view.id);
      setDraft(null);
    });
  }

  function saveCurrentSettings() {
    if (!activeView) return;
    setError(null);
    startTransition(async () => {
      const result = await updateViewAction({
        id: activeView.id,
        name: activeView.name,
        config: currentConfig,
      });
      if (!result.ok) return setError(result.error);
      setViews((current) => current.map((view) => view.id === result.view.id ? result.view : view));
    });
  }

  function setDefault(id: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setDefaultViewAction(id);
      if (!result.ok) return setError(result.error);
      setViews((current) => current.map((view) => ({ ...view, isDefault: view.id === id })));
    });
  }

  function removeView(view: SavedView) {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteViewAction(view.id);
      if (!result.ok) return setError(result.error);
      setViews((current) => current.filter((item) => item.id !== view.id));
      if (activeViewId === view.id) onActiveViewChange(null);
      setDeleteConfirm(false);
      setDraft(null);
    });
  }

  return (
    <Sheet onOpenChange={(open) => {
      if (!open) {
        setDraft(null);
        setError(null);
        setDeleteConfirm(false);
      }
    }}>
      <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}>
        <EyeIcon className="size-3.5" />
        <span className="max-w-28 truncate">{activeView?.name ?? "View"}</span>
        {dirty && <span className="size-1.5 rounded-full bg-amber-600" title="Unsaved view changes" />}
        <ChevronRightIcon className="size-3.5" />
      </SheetTrigger>
      <SheetContent className="w-[min(92vw,520px)] gap-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-stone-200 px-5 py-4">
          <SheetTitle className="text-xl">Views</SheetTitle>
          <SheetDescription>Save board settings and divide the team into filtered sections.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {draft ? (
            <ViewEditor
              draft={draft}
              engineers={engineers}
              tags={tags}
              titles={titles}
              pending={pending}
              onChange={setDraft}
              onCancel={() => setDraft(null)}
              onSave={saveDraft}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Saved views</p>
                  <p className="mt-0.5 text-xs text-stone-500">Select a view to apply its saved settings.</p>
                </div>
                <Button size="sm" onClick={startCreate}><PlusIcon /> New view</Button>
              </div>

              <div className="mt-4 space-y-2">
                <div className={cn("rounded-lg border p-3", activeViewId === null ? "border-stone-800 bg-[#efeae0]" : "border-stone-250 bg-[#faf7ef]")}>
                  <button type="button" className="flex w-full items-start gap-3 text-left" onClick={applyUnsavedView}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">No saved view</span>
                      <span className="mt-1 block text-xs text-stone-500">Keep current board settings without team dividers.</span>
                    </span>
                    {activeViewId === null && <CheckIcon className="mt-0.5 size-4 text-stone-800" />}
                  </button>
                </div>
                {views.length === 0 && (
                  <div className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
                    No saved views yet. Your first view will inherit the current board settings.
                  </div>
                )}
                {views.map((view) => {
                  const selected = view.id === activeViewId;
                  return (
                    <div key={view.id} className={cn("rounded-lg border p-3", selected ? "border-stone-800 bg-[#efeae0]" : "border-stone-250 bg-[#faf7ef]")}>
                      <div className="flex items-start gap-3">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => applyView(view)}>
                          <span className="flex items-center gap-1.5 font-medium">
                            {view.name}
                            {view.isDefault && <StarIcon className="size-3.5 fill-[#c4a35a] text-[#8a6a24]" />}
                          </span>
                          <span className="mt-1 block text-xs text-stone-500">
                            {describeView(view)}
                          </span>
                        </button>
                        {selected && <CheckIcon className="mt-0.5 size-4 text-stone-800" />}
                        <Button variant="ghost" size="xs" onClick={() => startEdit(view)}>Edit</Button>
                      </div>
                      {selected && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-300 pt-3">
                          <Button variant="outline" size="xs" disabled={!dirty || pending} onClick={saveCurrentSettings}>
                            <SaveIcon /> Save current settings
                          </Button>
                          <Button variant="ghost" size="xs" disabled={pending} onClick={() => setDefault(view.isDefault ? null : view.id)}>
                            <StarIcon /> {view.isDefault ? "Remove default" : "Set as default"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-lg border border-stone-250 bg-[#faf7ef] p-3">
                <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-medium">Show project name</span>
                    <span className="mt-0.5 block text-xs text-stone-500">Display the project name on work cards.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={currentConfig.showProjectName}
                    onChange={(event) => onShowProjectNameChange(event.target.checked)}
                    className="size-4 accent-stone-900"
                  />
                </label>
              </div>
            </>
          )}
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </div>

        {!draft && activeView && (
          <SheetFooter className="flex-row items-center justify-between border-t border-stone-200 px-5 py-3">
            <span className="text-xs text-stone-500">Changes stay temporary until saved.</span>
            <Button variant="destructive" size="xs" disabled={pending} onClick={() => removeView(activeView)}>
              <Trash2Icon /> {deleteConfirm ? "Confirm delete" : "Delete view"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ViewEditor({
  draft,
  engineers,
  tags,
  titles,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  engineers: Engineer[];
  tags: string[];
  titles: string[];
  pending: boolean;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const candidates = engineers.filter((person) => !draft.config.engineerFilter.length || draft.config.engineerFilter.includes(person.id));
  const invalid = !draft.name.trim() || draft.config.sections.some((section) =>
    !section.name.trim() || (section.filter.kind !== "remainder" && !section.filter.value.trim()),
  );

  function setSections(sections: ViewSection[]) {
    onChange({ ...draft, config: { ...draft.config, sections } });
  }

  function updateSection(index: number, section: ViewSection) {
    setSections(draft.config.sections.map((item, itemIndex) => itemIndex === index ? section : item));
  }

  function addSection(kind: ViewSectionFilter["kind"] = "tag") {
    const filter: ViewSectionFilter = kind === "remainder" ? { kind } : { kind, value: "" };
    setSections([...draft.config.sections, {
      id: crypto.randomUUID(),
      name: kind === "remainder" ? "Everyone else" : "",
      filter,
    }]);
  }

  return (
    <div>
      <button type="button" onClick={onCancel} className="text-xs text-stone-500 hover:text-stone-900">← Back to views</button>
      <div className="mt-4">
        <label className="text-xs font-medium text-stone-600" htmlFor="view-name">View name</label>
        <input
          id="view-name"
          autoFocus
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="e.g. Teams by discipline"
          className="mt-1 h-9 w-full rounded-md border border-stone-300 bg-[#faf7ef] px-3 text-sm outline-none focus:border-stone-700"
        />
        <p className="mt-1.5 text-xs text-stone-500">
          {draft.id ? "Editing this view’s saved structure." : "Current lens, horizon, filters, highlight, and card display are inherited."}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <p className="font-medium">Team sections</p>
          <p className="mt-0.5 text-xs text-stone-500">People may appear in every section they match.</p>
        </div>
        <Button variant="outline" size="xs" onClick={() => addSection()}><PlusIcon /> Add section</Button>
      </div>

      <div className="mt-3 space-y-3">
        {draft.config.sections.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-xs text-stone-500">
            Add a section to place named dividers in the team view.
          </div>
        )}
        {draft.config.sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            count={sectionMatchCount(section, draft.config.sections, candidates)}
            engineers={engineers}
            tags={tags}
            titles={titles}
            onChange={(next) => updateSection(index, next)}
            onMove={(direction) => {
              const nextIndex = index + direction;
              if (nextIndex < 0 || nextIndex >= draft.config.sections.length) return;
              const next = [...draft.config.sections];
              [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
              setSections(next);
            }}
            onRemove={() => setSections(draft.config.sections.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))}
      </div>

      {!draft.config.sections.some((section) => section.filter.kind === "remainder") && draft.config.sections.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => addSection("remainder")}>
          <LayersIcon /> Add “not in other sections”
        </Button>
      )}

      {!draft.id && (
        <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.makeDefault}
            onChange={(event) => onChange({ ...draft, makeDefault: event.target.checked })}
            className="size-4 accent-stone-900"
          />
          Open this view by default
        </label>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-stone-200 pt-4">
        <Button variant="ghost" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button disabled={invalid || pending} onClick={onSave}><SaveIcon /> {draft.id ? "Save view" : "Create view"}</Button>
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  index,
  count,
  engineers,
  tags,
  titles,
  onChange,
  onMove,
  onRemove,
}: {
  section: ViewSection;
  index: number;
  count: number;
  engineers: Engineer[];
  tags: string[];
  titles: string[];
  onChange: (section: ViewSection) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const filter = section.filter;
  return (
    <div className="rounded-lg border border-stone-300 bg-[#faf7ef] p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-200 font-mono text-[10px]">{index + 1}</span>
        <input
          aria-label={`Section ${index + 1} name`}
          value={section.name}
          onChange={(event) => onChange({ ...section, name: event.target.value })}
          placeholder="Section name"
          className="h-8 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-sm outline-none focus:border-stone-700"
        />
        <span className="text-[11px] text-stone-500">{count} {count === 1 ? "person" : "people"}</span>
        <Button variant="ghost" size="icon-xs" aria-label="Move section up" onClick={() => onMove(-1)}><ArrowUpIcon /></Button>
        <Button variant="ghost" size="icon-xs" aria-label="Move section down" onClick={() => onMove(1)}><ArrowDownIcon /></Button>
        <Button variant="ghost" size="icon-xs" aria-label="Remove section" onClick={onRemove}><Trash2Icon /></Button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-stone-500">Where</span>
        <select
          aria-label="Section filter field"
          value={filter.kind}
          onChange={(event) => {
            const kind = event.target.value as ViewSectionFilter["kind"];
            onChange({ ...section, filter: kind === "remainder" ? { kind } : { kind, value: "" } });
          }}
          className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs"
        >
          <option value="tag">Tag</option>
          <option value="title">Title</option>
          <option value="person">Person</option>
          <option value="remainder">Not in other sections</option>
        </select>
        {filter.kind !== "remainder" && <span className="text-xs text-stone-500">is</span>}
        {filter.kind === "person" ? (
          <select
            aria-label="Person filter value"
            value={filter.value}
            onChange={(event) => onChange({ ...section, filter: { kind: "person", value: event.target.value } })}
            className="h-8 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-xs"
          >
            <option value="">Choose a person</option>
            {engineers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        ) : filter.kind === "tag" || filter.kind === "title" ? (
          <>
            <input
              aria-label={`${filter.kind} filter value`}
              list={`view-${filter.kind}-values`}
              value={filter.value}
              onChange={(event) => onChange({ ...section, filter: { kind: filter.kind, value: event.target.value } })}
              placeholder={filter.kind === "tag" ? "AI team" : "Engineer"}
              className="h-8 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 text-xs outline-none focus:border-stone-700"
            />
            <datalist id={`view-${filter.kind}-values`}>
              {(filter.kind === "tag" ? tags : titles).map((value) => <option key={value} value={value} />)}
            </datalist>
          </>
        ) : (
          <span className="text-xs text-stone-500">Matches nobody claimed by another section</span>
        )}
      </div>
    </div>
  );
}

function copySection(section: ViewSection): ViewSection {
  return { ...section, filter: { ...section.filter } };
}

function sectionMatchCount(section: ViewSection, sections: ViewSection[], people: Engineer[]) {
  return peopleInViewSection(section, sections, people).length;
}

function describeView(view: SavedView) {
  const { config } = view;
  const bits = [config.lens === "team" ? "Team" : "Projects", config.horizon ? `${config.horizon} sprints` : "All sprints"];
  if (config.sections.length) bits.push(`${config.sections.length} ${config.sections.length === 1 ? "section" : "sections"}`);
  if (config.engineerFilter.length) bits.push(`${config.engineerFilter.length} people`);
  if (config.projectFilter.length) bits.push(`${config.projectFilter.length} projects`);
  return bits.join(" · ");
}
