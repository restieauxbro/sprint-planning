"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScheduleIntent } from "@/lib/schema";
import type { BoardViewConfig, SavedView } from "@/lib/saved-views";
import {
  matchesTagConditions,
  splitTags,
  type TagCondition,
} from "@/lib/tag-conditions";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ScheduleResult } from "../_lib/schedule";
import { projectCode, projectInk } from "./colors";
import { Inspector } from "./inspector";
import { ProjectGrid } from "./project-grid";
import type { Selection } from "./selection";
import { TeamGrid } from "./team-grid";
import { usePlanWatch } from "./use-plan-watch";
import { ViewManager } from "./view-manager";

const HORIZONS = [6, 8, 12, 0] as const;

export function Board({ intent, result, savedViews }: { intent: ScheduleIntent; result: ScheduleResult; savedViews: SavedView[] }) {
  const { live, flash, updatedAt, refresh } = usePlanWatch();
  const defaultView = savedViews.find((view) => view.isDefault) ?? null;
  const initialConfig = defaultView?.config;
  const [lens, setLens] = useState<"team" | "projects">(initialConfig?.lens ?? "team");
  const [horizon, setHorizon] = useState<number>(initialConfig?.horizon ?? 8);
  const [projectFilter, setProjectFilter] = useState<string[]>(initialConfig?.projectFilter ?? []);
  const [engineerFilter, setEngineerFilter] = useState<string[]>(initialConfig?.engineerFilter ?? []);
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(initialConfig?.highlightProjectId ?? null);
  const [showProjectName, setShowProjectName] = useState(initialConfig?.showProjectName ?? true);
  const [sections, setSections] = useState(initialConfig?.sections ?? []);
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const currentViewConfig = useMemo<BoardViewConfig>(() => ({
    lens,
    horizon,
    projectFilter,
    engineerFilter,
    highlightProjectId,
    showProjectName,
    sections,
  }), [lens, horizon, projectFilter, engineerFilter, highlightProjectId, showProjectName, sections]);

  function applyViewConfig(config: BoardViewConfig) {
    setLens(config.lens);
    setHorizon(config.horizon);
    setProjectFilter(config.projectFilter);
    setEngineerFilter(config.engineerFilter);
    setHighlightProjectId(config.highlightProjectId);
    setShowProjectName(config.showProjectName);
    setSections(config.sections);
    setSelected(null);
  }

  const projectIndex = useMemo(() => {
    const map = new Map<string, number>();
    intent.projects.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [intent.projects]);

  const visibleSprints = useMemo(() => {
    const from = result.planningStartIndex;
    const all = intent.sprints.slice(from);
    if (horizon === 0) return all;
    return all.slice(0, horizon);
  }, [intent.sprints, result.planningStartIndex, horizon]);

  const visibleSprintIds = useMemo(
    () => new Set(visibleSprints.map((s) => s.id)),
    [visibleSprints],
  );

  const engineers = intent.engineers.filter(
    (e) => engineerFilter.length === 0 || engineerFilter.includes(e.id),
  );
  const projects = intent.projects.filter(
    (p) => projectFilter.length === 0 || projectFilter.includes(p.id),
  );
  const phases = intent.phases.filter(
    (p) => projectFilter.length === 0 || projectFilter.includes(p.projectId),
  );
  const projectViewProjects = projects.filter((project) => {
    if (!engineerFilter.length) return true;
    const projectPhaseIds = new Set(
      phases.filter((phase) => phase.projectId === project.id).map((phase) => phase.id),
    );
    return intent.assignments.some(
      (assignment) =>
        projectPhaseIds.has(assignment.phaseId) && engineerFilter.includes(assignment.engineerId),
    );
  });
  const projectViewPhases = phases.filter((phase) =>
    projectViewProjects.some((project) => project.id === phase.projectId),
  );
  const segments = result.segments.filter((s) => {
    if (!visibleSprintIds.has(s.sprintId)) return false;
    if (engineerFilter.length && !engineerFilter.includes(s.engineerId)) return false;
    if (projectFilter.length && !projectFilter.includes(s.projectId)) return false;
    return true;
  });
  const loads = result.loads.filter((l) => visibleSprintIds.has(l.sprintId));

  function toggleEngineer(id: string) {
    setEngineerFilter((prev) => (prev.length === 1 && prev[0] === id ? [] : [id]));
  }

  function copySnapshot() {
    const lines = intent.projects.map((project) => {
      const ends = intent.phases
        .filter((p) => p.projectId === project.id)
        .map((p) => result.phaseTimelines.find((t) => t.phaseId === p.id)?.endSprintId)
        .filter(Boolean);
      const last = visibleSprints.filter((s) => ends.includes(s.id)).at(-1);
      return `${projectCode(project)} ${project.name} · P${project.priority} · ends ${last?.name ?? "—"}`;
    });
    const unscheduled = result.phaseTimelines.filter((t) => t.unscheduled);
    if (unscheduled.length) {
      lines.push(
        `Unscheduled: ${unscheduled
          .map((t) => intent.phases.find((p) => p.id === t.phaseId)?.name)
          .join(", ")}`,
      );
    }
    void navigator.clipboard.writeText(lines.join("\n"));
  }

  function onHighlight(projectId: string) {
    setHighlightProjectId((prev) => (prev === projectId ? null : projectId));
  }

  return (
    <div className="flex h-full flex-col bg-[#f4f0e6] text-stone-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-300 px-4 py-2.5">
        <LivePill live={live} flash={flash} updatedAt={updatedAt} stale={!intent.sprints.length} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={String(horizon)}
            onChange={(v) => setHorizon(Number(v))}
            options={HORIZONS.map((n) => ({
              value: String(n),
              label: n === 0 ? "All" : `${n}`,
            }))}
            prefix="Horizon"
          />
          <Segmented
            value={lens}
            onChange={(v) => setLens(v as "team" | "projects")}
            options={[
              { value: "team", label: "Team" },
              { value: "projects", label: "Projects" },
            ]}
          />
          <FilterMenu
            label={projectFilter.length ? `${projectFilter.length} projects` : "Projects"}
            searchPlaceholder="Search projects…"
            items={intent.projects.map((p) => ({
              id: p.id,
              name: p.name,
              code: projectCode(p),
              swatch: projectInk(p.color ?? projectIndex.get(p.id) ?? 0).fill,
              tags: p.tags,
            }))}
            selected={projectFilter}
            onChange={setProjectFilter}
            searchable
          />
          <FilterMenu
            label={
              engineerFilter.length
                ? `${engineerFilter.length} ${engineerFilter.length === 1 ? "person" : "people"}`
                : "People"
            }
            searchPlaceholder="Search people…"
            items={intent.engineers.map((e) => ({ id: e.id, name: e.name, tags: e.tags }))}
            selected={engineerFilter}
            onChange={setEngineerFilter}
            searchable
          />
          <FilterMenu
            label={
              highlightProjectId
                ? projectCode(
                    intent.projects.find((p) => p.id === highlightProjectId) ?? {
                      name: "Highlight",
                    },
                  )
                : "Highlight"
            }
            items={[
              { id: "", name: "None" },
              ...intent.projects.map((p) => ({
                id: p.id,
                name: p.name,
                code: projectCode(p),
                swatch: projectInk(p.color ?? projectIndex.get(p.id) ?? 0).fill,
              })),
            ]}
            selected={highlightProjectId ? [highlightProjectId] : [""]}
            onChange={(ids) => setHighlightProjectId(ids.find((id) => id) || null)}
            single
            searchable
            searchPlaceholder="Search projects…"
            swatch={
              highlightProjectId
                ? projectInk(intent.projects.find((project) => project.id === highlightProjectId)?.color ?? projectIndex.get(highlightProjectId) ?? 0).fill
                : undefined
            }
          />
          <ViewManager
            initialViews={savedViews}
            engineers={intent.engineers}
            currentConfig={currentViewConfig}
            activeViewId={activeViewId}
            onApply={applyViewConfig}
            onActiveViewChange={setActiveViewId}
            onShowProjectNameChange={setShowProjectName}
          />
          <Button variant="outline" size="sm" onClick={copySnapshot}>
            Copy snapshot
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh">
            <RefreshCwIcon />
          </Button>
        </div>
      </header>

      {result.alerts.length > 0 && (
        <div className="border-b border-stone-300 bg-[#f3e4d4] px-4 py-1.5 text-[13px]">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setAlertOpen((v) => !v)}
          >
            <Badge variant="destructive">{result.alerts.length}</Badge>
            <span className="truncate text-[#7c2d12]">{result.alerts[0]?.message}</span>
            <span className="ml-auto text-[11px] text-stone-500">
              {alertOpen ? "Hide" : "All alerts"}
            </span>
          </button>
          {alertOpen && (
            <ul className="mt-1.5 space-y-1">
              {result.alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    className="text-left text-[#7c2d12] hover:underline"
                    onClick={() => {
                      if (alert.phaseId) setSelected({ kind: "phase", phaseId: alert.phaseId });
                      else if (alert.engineerId && alert.sprintId) {
                        setSelected({
                          kind: "idle",
                          engineerId: alert.engineerId,
                          sprintId: alert.sprintId,
                        });
                      }
                    }}
                  >
                    {alert.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          ref={scroller}
          className="min-w-0 flex-1 overflow-auto"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") scroller.current?.scrollBy({ left: 120, behavior: "smooth" });
            if (e.key === "ArrowLeft") scroller.current?.scrollBy({ left: -120, behavior: "smooth" });
            if (e.key === "Escape") setSelected(null);
          }}
        >
          {lens === "team" ? (
            <TeamGrid
              engineers={engineers}
              roster={intent.engineers}
              sprints={visibleSprints}
              projects={projects}
              phases={phases}
              segments={segments}
              loads={loads}
              currentSprintId={result.currentSprintId}
              highlightProjectId={highlightProjectId}
              selected={selected}
              onSelect={setSelected}
              onToggleEngineer={toggleEngineer}
              projectIndex={projectIndex}
              showProjectName={showProjectName}
              sections={sections}
            />
          ) : (
            <ProjectGrid
              projects={projectViewProjects}
              phases={projectViewPhases}
              engineers={intent.engineers}
              assignments={intent.assignments}
              sprints={visibleSprints}
              timelines={result.phaseTimelines}
              highlightProjectId={highlightProjectId}
              selected={selected}
              onSelect={setSelected}
              onHighlight={onHighlight}
              projectIndex={projectIndex}
            />
          )}
        </div>
        {selected && (
          <Inspector
            selection={selected}
            onClose={() => setSelected(null)}
            intent={intent}
            timelines={result.phaseTimelines}
            loads={result.loads}
            sprints={intent.sprints}
            projectIndex={projectIndex}
          />
        )}
      </div>
    </div>
  );
}

function LivePill({
  live,
  flash,
  updatedAt,
  stale,
}: {
  live: "connecting" | "live" | "down";
  flash: boolean;
  updatedAt: Date | null;
  stale: boolean;
}) {
  const tone = stale || live === "down" ? "bg-amber-200 text-amber-950" : "bg-emerald-100 text-emerald-950";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase", tone)}>
        {stale ? "missing db" : live === "down" ? "offline" : live === "connecting" ? "connecting" : "live"}
      </span>
      {flash && (
        <span className="rounded-sm bg-stone-900 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#f4f0e6] uppercase">
          Plan updated
        </span>
      )}
      {updatedAt && (
        <span className="font-mono text-[10px] text-stone-500">
          {updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
      <span className="hidden font-mono text-[10px] text-stone-400 sm:inline">planner.sqlite</span>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  prefix,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  prefix?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-stone-300 bg-[#efeae0] p-0.5">
      {prefix && <span className="pl-1.5 font-mono text-[10px] text-stone-500">{prefix}</span>}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-sm px-2 py-0.5 text-[12px]",
            value === opt.value ? "bg-stone-900 text-[#f4f0e6]" : "text-stone-600 hover:text-stone-900",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FilterMenu({
  label,
  searchPlaceholder,
  items,
  selected,
  onChange,
  single,
  swatch,
  searchable,
}: {
  label: string;
  searchPlaceholder?: string;
  items: { id: string; name: string; code?: string; swatch?: string; tags?: string | null }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
  swatch?: string;
  searchable?: boolean;
}) {
  const clearable = !single && selected.length > 0;
  const selectedItems = items.filter((item) => selected.includes(item.id));
  const tagOptions = Array.from(new Set(items.flatMap((item) => splitTags(item.tags)))).sort(
    (a, b) => a.localeCompare(b),
  );

  return (
    <div className="flex">
      {searchable && single ? (
        <Combobox
          items={items}
          value={selectedItems[0] ?? null}
          onValueChange={(nextItem) => onChange(nextItem?.id ? [nextItem.id] : [])}
          itemToStringLabel={(item) => `${item.name} ${item.code ?? ""}`}
        >
          <ComboboxTrigger render={<Button variant="outline" size="sm" />} className="gap-1">
            {swatch && <span className="size-2.5 rounded-sm" style={{ background: swatch }} />}
            {label}
          </ComboboxTrigger>
          <ComboboxContent align="end" sideOffset={4} className="w-64">
            <ComboboxInput
              autoFocus
              showTrigger={false}
              showSearchIcon
              placeholder={searchPlaceholder ?? "Search…"}
            />
            <ComboboxEmpty>No matches found.</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item.id || "none"} value={item}>
                  <FilterItemLabel item={item} />
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ) : searchable ? (
        <Combobox
          items={items}
          multiple
          value={selectedItems}
          onValueChange={(nextItems) => onChange(nextItems.map((item) => item.id))}
          itemToStringLabel={(item) => `${item.name} ${item.code ?? ""} ${item.tags ?? ""}`}
        >
          <ComboboxTrigger
            render={<Button variant="outline" size="sm" />}
            className={cn("gap-1", clearable && "rounded-r-none")}
          >
            {swatch && <span className="size-2.5 rounded-sm" style={{ background: swatch }} />}
            {label}
          </ComboboxTrigger>
          <ComboboxContent align="end" sideOffset={4} className="w-80">
            <ConditionSelector items={items} tags={tagOptions} onChange={onChange} />
            <ComboboxInput
              autoFocus
              showTrigger={false}
              showSearchIcon
              placeholder={searchPlaceholder ?? "Search…"}
            />
            <ComboboxEmpty>No matches found.</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item.id} value={item}>
                  <FilterItemLabel item={item} />
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1",
              clearable && "rounded-r-none",
            )}
          >
            {swatch && (
              <span className="size-2.5 rounded-sm" style={{ background: swatch }} />
            )}
            {label}
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.id || "none"}
                checked={selected.includes(item.id)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked ? [...selected, item.id] : selected.filter((id) => id !== item.id),
                  );
                }}
              >
                <FilterItemLabel item={item} />
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {clearable && (
        <Button
          variant="outline"
          size="icon-sm"
          className="-ml-px rounded-l-none"
          aria-label={`Clear ${label} filter`}
          title={`Clear ${label} filter`}
          onClick={() => onChange([])}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

function FilterItemLabel({
  item,
}: {
  item: { name: string; code?: string; swatch?: string; tags?: string | null };
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {item.swatch && (
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: item.swatch }} />
      )}
      {item.code && (
        <span className="inline-flex min-w-6 shrink-0 justify-center text-[13px] leading-none text-muted-foreground">
          {item.code}
        </span>
      )}
      <span className="truncate">{item.name}</span>
    </span>
  );
}

type EditableTagCondition = TagCondition & { id: number };

function ConditionSelector({
  items,
  tags,
  onChange,
}: {
  items: { id: string; tags?: string | null }[];
  tags: string[];
  onChange: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [conditions, setConditions] = useState<EditableTagCondition[]>([]);
  const nextId = useRef(0);
  const matchingIds = conditions.length
    ? items
        .filter((item) => matchesTagConditions(item.tags, conditions))
        .map((item) => item.id)
    : [];

  function addCondition() {
    if (!tags.length) return;
    setConditions((current) => [
      ...current,
      { id: nextId.current++, kind: "tagged", tag: tags[0] },
    ]);
  }

  function openSelector() {
    setExpanded(true);
    if (!conditions.length) addCondition();
  }

  return (
    <div
      className="max-h-64 overflow-y-auto border-b border-border p-2"
      onKeyDown={(event) => event.stopPropagation()}
    >
      {!expanded ? (
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-accent disabled:opacity-50"
          disabled={!tags.length}
          onClick={openSelector}
        >
          Select by conditions
          <PlusIcon className="size-3.5 text-muted-foreground" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium">Match all conditions</span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              Done
            </button>
          </div>
          {conditions.map((condition) => (
            <div key={condition.id} className="flex items-center gap-1">
              <select
                aria-label="Tag condition"
                className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
                value={condition.kind}
                onChange={(event) =>
                  setConditions((current) =>
                    current.map((item) =>
                      item.id === condition.id
                        ? { ...item, kind: event.target.value as TagCondition["kind"] }
                        : item,
                    ),
                  )
                }
              >
                <option value="tagged">Tagged</option>
                <option value="not-tagged">Not tagged</option>
              </select>
              <select
                aria-label="Tag"
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
                value={condition.tag}
                onChange={(event) =>
                  setConditions((current) =>
                    current.map((item) =>
                      item.id === condition.id ? { ...item, tag: event.target.value } : item,
                    ),
                  )
                }
              >
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove condition"
                onClick={() =>
                  setConditions((current) => current.filter((item) => item.id !== condition.id))
                }
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="xs" onClick={addCondition} disabled={!tags.length}>
              <PlusIcon />
              Add condition
            </Button>
            <Button
              size="xs"
              disabled={!conditions.length}
              onClick={() => onChange(matchingIds)}
            >
              Select {matchingIds.length} {matchingIds.length === 1 ? "match" : "matches"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
