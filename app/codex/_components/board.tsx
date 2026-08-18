"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Eye,
  Filter,
  Highlighter,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScheduleIntent } from "@/lib/schema";
import type { CellSegment, ScheduleResult } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";
import { Inspector, type InspectorSelection } from "./inspector";
import { projectInk } from "./colors";

type Lens = "team" | "projects";
type Horizon = 6 | 8 | 12 | "all";

const hatch = "repeating-linear-gradient(135deg, transparent 0 5px, rgba(68,58,43,.22) 5px 7px)";
const fmt = (value: number) => Number(value.toFixed(1)).toString();
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const shortDate = (value: string) => {
  const [, , day] = value.split("-");
  const monthName = new Date(`${value}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  return `${day} ${monthName}`;
};

function MultiFilter({
  kind,
  items,
  selected,
  onChange,
  colors,
}: {
  kind: "Projects" | "People";
  items: { id: string; name: string; code?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  colors?: Map<string, { solid: string }>;
}) {
  const toggle = (id: string) => {
    const active = selected.length === 0 ? items.map((item) => item.id) : selected;
    const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id];
    onChange(next.length === items.length ? [] : next);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        {kind === "Projects" ? <Filter /> : <Users />}
        {kind}{selected.length ? ` · ${selected.length}` : " · All"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{kind}</DropdownMenuLabel>
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.id}
              checked={selected.length === 0 || selected.includes(item.id)}
              onCheckedChange={() => toggle(item.id)}
              onClick={(event) => event.preventDefault()}
            >
              {colors && <span className="size-2.5 shrink-0" style={{ background: colors.get(item.id)?.solid }} />}
              {item.code && <span className="inline-flex min-w-6 shrink-0 justify-center text-[13px] leading-none">{item.code}</span>}
              <span>{item.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HighlightMenu({
  projects,
  value,
  onChange,
  colors,
}: {
  projects: ScheduleIntent["projects"];
  value: string | null;
  onChange: (id: string | null) => void;
  colors: Map<string, { solid: string }>;
}) {
  const active = projects.find((project) => project.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Highlighter />
        {active ? <><span className="size-2" style={{ background: colors.get(active.id)?.solid }} />{active.code}</> : "Highlight · None"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuRadioGroup value={value ?? "none"} onValueChange={(next) => onChange(next === "none" ? null : next)}>
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
          {projects.map((project) => (
            <DropdownMenuRadioItem key={project.id} value={project.id}>
              <span className="size-2.5" style={{ background: colors.get(project.id)?.solid }} />
              <span className="inline-flex min-w-6 shrink-0 justify-center text-[13px] leading-none">{project.code}</span>{project.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewMenu({
  showProjectName,
  onShowProjectNameChange,
}: {
  showProjectName: boolean;
  onShowProjectNameChange: (show: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Eye />
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show on cards</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={showProjectName}
            onCheckedChange={onShowProjectNameChange}
          >
            Project name
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkBar({
  segment,
  intent,
  sprintWorkingDays,
  ink,
  dimmed,
  onSelect,
  showProjectName,
}: {
  segment: CellSegment;
  intent: ScheduleIntent;
  sprintWorkingDays: number;
  ink: { solid: string; pale: string; border: string };
  dimmed: boolean;
  onSelect: () => void;
  showProjectName: boolean;
}) {
  const phase = intent.phases.find((item) => item.id === segment.phaseId)!;
  const project = intent.projects.find((item) => item.id === segment.projectId)!;
  const engineer = intent.engineers.find((item) => item.id === segment.engineerId)!;
  const width = segment.unfilled
    ? segment.requestedFraction * 100
    : (segment.days / sprintWorkingDays) * 100;
  const label = showProjectName
    ? `${project.name} · ${project.code} ${phase.name}`
    : `${project.code} ${phase.name}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative min-h-10 overflow-hidden border px-1.5 py-1 text-left transition-opacity"
      style={{
        width: `${Math.max(width, segment.unfilled ? 4 : 1.5)}%`,
        backgroundColor: ink.pale,
        backgroundImage: segment.unfilled ? hatch : undefined,
        borderColor: ink.border,
        opacity: dimmed ? 0.25 : 1,
      }}
      title={segment.unfilled
        ? `${label}: ${Math.round(segment.requestedFraction * 100)}% requested and queued. Sized ${formatEffortDays(phase.effortDays)}.`
        : `${label}: ${fmt(segment.days)} days delivered. Sized ${formatEffortDays(phase.effortDays)}.`}
    >
      <span className="block truncate text-[10px] font-semibold" style={{ color: ink.border }}>{label}</span>
      <span className="block truncate font-mono text-[9px] text-stone-600">
        {initials(engineer.name)} {Math.round(segment.requestedFraction * 100)}%
        {segment.unfilled ? " queued" : ""}
      </span>
    </button>
  );
}

function TeamGrid({
  intent,
  result,
  sprints,
  selectedPeople,
  selectedProjects,
  highlight,
  onSelection,
  onPersonClick,
  colors,
  showProjectName,
}: {
  intent: ScheduleIntent;
  result: ScheduleResult;
  sprints: ScheduleIntent["sprints"];
  selectedPeople: string[];
  selectedProjects: string[];
  highlight: string | null;
  onSelection: (selection: InspectorSelection) => void;
  onPersonClick: (id: string) => void;
  colors: Map<string, { solid: string; pale: string; border: string }>;
  showProjectName: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const people = intent.engineers.filter((engineer) => !selectedPeople.length || selectedPeople.includes(engineer.id));
  const template = `168px repeat(${sprints.length}, minmax(112px, 1fr))`;
  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          scrollRef.current?.scrollBy({ left: event.key === "ArrowRight" ? 180 : -180, behavior: "smooth" });
        }
      }}
      className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
      aria-label="Team sprint timeline. Use arrow keys to scroll."
    >
      <div style={{ minWidth: 168 + sprints.length * 112 }}>
        <div className="sticky top-0 z-20 grid border-y border-stone-300 bg-[#eee8dc]" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-30 border-r border-stone-300 bg-[#eee8dc] px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-stone-500 uppercase">People · FTE</div>
          {sprints.map((sprint) => (
            <div key={sprint.id} className={`border-r border-stone-300 px-3 py-2 ${sprint.id === result.currentSprintId ? "bg-stone-100" : ""}`}>
              <div className="flex items-center gap-2"><strong className="font-mono text-xs">{sprint.name}</strong>{sprint.id === result.currentSprintId && <Badge className="h-4 px-1 text-[8px]">now</Badge>}</div>
              <span className="font-mono text-[9px] text-stone-500">{shortDate(sprint.startDate)} – {shortDate(sprint.endDate)}</span>
            </div>
          ))}
        </div>
        {people.map((engineer) => (
          <div key={engineer.id} className="grid border-b border-stone-300" style={{ gridTemplateColumns: template }}>
            <button type="button" onClick={() => onPersonClick(engineer.id)} className="sticky left-0 z-10 min-h-24 border-r border-stone-300 bg-[#f4f0e6] px-4 py-4 text-left hover:bg-[#eae3d5]">
              <strong className="block text-sm">{engineer.name}</strong>
              <span className="mt-1 block font-mono text-[10px] text-stone-500">{engineer.fte.toFixed(1)} FTE</span>
            </button>
            {sprints.map((sprint) => {
              const load = result.loads.find((item) => item.engineerId === engineer.id && item.sprintId === sprint.id);
              const timeOff = load?.timeOffDays ?? 0;
              const filtered = result.segments
                .filter((segment) => segment.engineerId === engineer.id && segment.sprintId === sprint.id)
                .filter((segment) => !selectedProjects.length || selectedProjects.includes(segment.projectId));
              const delivered = filtered.filter((segment) => !segment.unfilled).sort((a, b) => b.days - a.days);
              const unfilled = filtered.filter((segment) => segment.unfilled).sort((a, b) => b.requestedFraction - a.requestedFraction);
              const unusedFte = Math.max(0, sprint.workingDays - timeOff - (load?.capacityDays ?? 0));
              return (
                <div key={sprint.id} className={`relative min-h-24 border-r border-stone-300 p-1.5 ${sprint.id === result.currentSprintId ? "bg-amber-50/60" : "bg-[#faf7ef]/60"}`}>
                  {load?.overloaded && <span className="absolute right-1 top-1 z-10 bg-red-800 px-1.5 py-0.5 font-mono text-[9px] text-white">{Math.round(load.requestedFractionSum * 100)}%</span>}
                  <div className="flex w-full flex-wrap content-start gap-y-1">
                    {timeOff > 0 && <div className="min-h-10 border border-stone-500 bg-stone-200 px-1 py-1 font-mono text-[9px]" style={{ width: `${(timeOff / sprint.workingDays) * 100}%`, backgroundImage: hatch }} title={`${fmt(timeOff)} days Leave`}>Leave</div>}
                    {[...delivered, ...unfilled].map((segment) => (
                      <WorkBar key={`${segment.phaseId}:${segment.engineerId}:${segment.sprintId}`} segment={segment} intent={intent} sprintWorkingDays={sprint.workingDays} ink={colors.get(segment.projectId)!} dimmed={!!highlight && highlight !== segment.projectId} onSelect={() => onSelection({ type: "phase", phaseId: segment.phaseId })} showProjectName={showProjectName} />
                    ))}
                    {(load?.idleDays ?? 0) > 0.001 && <button type="button" onClick={() => onSelection({ type: "idle", engineerId: engineer.id, sprintId: sprint.id })} className="min-h-10 border border-dashed border-stone-400 bg-transparent px-1 py-1 text-left font-mono text-[9px] text-stone-500 hover:bg-stone-100" style={{ width: `${(load!.idleDays / sprint.workingDays) * 100}%` }} title={`${fmt(load!.idleDays)} idle days`}>idle {fmt(load!.idleDays)}d</button>}
                    {unusedFte > 0.001 && <div className="min-h-7 border border-stone-300 bg-stone-300/70 px-1 py-1 font-mono text-[8px] text-stone-600" style={{ width: `${(unusedFte / sprint.workingDays) * 100}%` }} title={`${fmt(unusedFte)} days unavailable through FTE`}>unused FTE</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectsGrid({
  intent,
  result,
  sprints,
  selectedProjects,
  selectedPeople,
  highlight,
  setHighlight,
  onSelection,
  colors,
  showProjectName,
}: {
  intent: ScheduleIntent;
  result: ScheduleResult;
  sprints: ScheduleIntent["sprints"];
  selectedProjects: string[];
  selectedPeople: string[];
  highlight: string | null;
  setHighlight: (id: string | null) => void;
  onSelection: (selection: InspectorSelection) => void;
  colors: Map<string, { solid: string; pale: string; border: string }>;
  showProjectName: boolean;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleIds = new Set(sprints.map((sprint) => sprint.id));
  const sprintPosition = new Map(sprints.map((sprint, index) => [sprint.id, index]));
  const projects = intent.projects.filter((project) => !selectedProjects.length || selectedProjects.includes(project.id));
  const template = `168px repeat(${sprints.length}, minmax(112px, 1fr))`;
  const assignmentVisible = (phaseId: string) => !selectedPeople.length || intent.assignments.some((a) => a.phaseId === phaseId && selectedPeople.includes(a.engineerId));
  const unscheduled = result.phaseTimelines.filter((timeline) => timeline.unscheduled && projects.some((project) => project.id === timeline.projectId));
  return (
    <div ref={scrollRef} tabIndex={0} onKeyDown={(event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        scrollRef.current?.scrollBy({ left: event.key === "ArrowRight" ? 180 : -180, behavior: "smooth" });
      }
    }} className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-stone-500" aria-label="Project sprint timeline. Use arrow keys to scroll.">
      <div style={{ minWidth: 168 + sprints.length * 112 }}>
        <div className="sticky top-0 z-20 grid border-y border-stone-300 bg-[#eee8dc]" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-30 border-r border-stone-300 bg-[#eee8dc] px-4 py-3 font-mono text-[10px] tracking-[0.15em] text-stone-500 uppercase">Projects</div>
          {sprints.map((sprint) => <div key={sprint.id} className={`border-r border-stone-300 px-3 py-2 ${sprint.id === result.currentSprintId ? "bg-stone-100" : ""}`}><div className="flex items-center gap-2"><strong className="font-mono text-xs">{sprint.name}</strong>{sprint.id === result.currentSprintId && <Badge className="h-4 px-1 text-[8px]">now</Badge>}</div><span className="font-mono text-[9px] text-stone-500">{shortDate(sprint.startDate)} – {shortDate(sprint.endDate)}</span></div>)}
        </div>
        {projects.map((project) => {
          const timelines = result.phaseTimelines.filter((timeline) => timeline.projectId === project.id && !timeline.unscheduled && assignmentVisible(timeline.phaseId));
          const remaining = timelines.reduce((sum, timeline) => sum + timeline.remainingDays, 0);
          const end = timelines.map((timeline) => timeline.endSprintId).filter(Boolean).sort((a, b) => intent.sprints.findIndex((s) => s.id === a) - intent.sprints.findIndex((s) => s.id === b)).at(-1);
          const isCollapsed = collapsed.includes(project.id);
          const ink = colors.get(project.id)!;
          return (
            <section key={project.id} className={highlight && highlight !== project.id ? "opacity-35" : ""}>
              <div role="button" tabIndex={0} onClick={() => setHighlight(highlight === project.id ? null : project.id)} onKeyDown={(event) => { if (event.key === "Enter") setHighlight(highlight === project.id ? null : project.id); }} className="sticky left-0 z-10 flex min-w-full cursor-pointer items-center gap-3 border-b border-stone-400 px-3 py-3" style={{ background: ink.pale }}>
                <button type="button" aria-label={isCollapsed ? "Expand project" : "Collapse project"} onClick={(event) => { event.stopPropagation(); setCollapsed((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]); }} className="grid size-6 place-items-center hover:bg-white/40">{isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</button>
                <span className="size-3" style={{ background: ink.solid }} />
                <strong className="font-heading text-xl">{project.code} · {project.name}</strong>
                <span className="font-mono text-[10px] text-stone-600">P{project.priority} · {fmt(remaining)}d left · ends {intent.sprints.find((sprint) => sprint.id === end)?.name ?? "—"}</span>
              </div>
              {!isCollapsed && timelines.map((timeline) => {
                const phase = intent.phases.find((item) => item.id === timeline.phaseId)!;
                const start = timeline.startSprintId && visibleIds.has(timeline.startSprintId) ? sprintPosition.get(timeline.startSprintId)! : 0;
                const endPosition = timeline.endSprintId && visibleIds.has(timeline.endSprintId) ? sprintPosition.get(timeline.endSprintId)! : sprints.length - 1;
                const intersects = timeline.startSprintId && timeline.endSprintId && intent.sprints.findIndex((s) => s.id === timeline.endSprintId) >= intent.sprints.findIndex((s) => s.id === sprints[0]?.id) && intent.sprints.findIndex((s) => s.id === timeline.startSprintId) <= intent.sprints.findIndex((s) => s.id === sprints.at(-1)?.id);
                const assignees = intent.assignments.filter((item) => item.phaseId === phase.id).filter((item) => !selectedPeople.length || selectedPeople.includes(item.engineerId)).map((assignment) => `${intent.engineers.find((item) => item.id === assignment.engineerId)?.name.split(" ")[0]} ${Math.round(assignment.fraction * 100)}%`).join(" · ");
                return (
                  <div key={phase.id} className="grid min-h-14 border-b border-stone-300" style={{ gridTemplateColumns: template }}>
                    <button type="button" onClick={() => onSelection({ type: "phase", phaseId: phase.id })} className="sticky left-0 z-10 border-r border-stone-300 bg-[#f4f0e6] px-4 py-3 text-left"><strong className="block truncate text-xs">{project.code} {phase.name}</strong><span className="font-mono text-[9px] text-stone-500">{formatEffortDays(phase.effortDays)}</span></button>
                    {sprints.map((sprint) => <div key={sprint.id} className={`border-r border-stone-300 ${sprint.id === result.currentSprintId ? "bg-amber-50/60" : "bg-[#faf7ef]/60"}`} />)}
                    {intersects && <button type="button" onClick={() => onSelection({ type: "phase", phaseId: phase.id })} className="z-[1] my-2 min-w-0 overflow-hidden border px-2 py-1 text-left" style={{ gridColumn: `${start + 2} / ${endPosition + 3}`, gridRow: 1, background: ink.solid, borderColor: ink.border, color: "#fff" }} title={`${project.code} ${phase.name}: ${assignees}`}><span className="block truncate text-[10px] font-semibold">{showProjectName ? `${project.name} · ` : ""}{project.code} {phase.name}</span><span className="block truncate font-mono text-[9px] opacity-80">{assignees}</span></button>}
                  </div>
                );
              })}
            </section>
          );
        })}
        {unscheduled.length > 0 && <section className="bg-amber-50">
          <div className="sticky left-0 z-10 border-y border-amber-300 bg-amber-100 px-4 py-3"><strong className="font-heading text-xl">Unscheduled</strong><span className="ml-3 font-mono text-[10px] text-amber-800">Effort with nobody assigned</span></div>
          {unscheduled.map((timeline) => {
            const phase = intent.phases.find((item) => item.id === timeline.phaseId)!;
            const project = intent.projects.find((item) => item.id === phase.projectId)!;
            return <div key={phase.id} className="grid min-h-14 border-b border-amber-200" style={{ gridTemplateColumns: template }}><button type="button" onClick={() => onSelection({ type: "phase", phaseId: phase.id })} className="sticky left-0 z-10 border-r border-amber-200 bg-amber-50 px-4 py-3 text-left"><strong className="block text-xs">{project.code} {phase.name}</strong><span className="font-mono text-[9px] text-amber-800">{formatEffortDays(phase.effortDays)}</span></button>{sprints.map((sprint, index) => <div key={sprint.id} className="border-r border-amber-200 p-2">{index === 0 && <button type="button" onClick={() => onSelection({ type: "phase", phaseId: phase.id })} className="w-full border border-dashed border-amber-700 px-2 py-2 text-left font-mono text-[9px] text-amber-900">{showProjectName ? `${project.name} · ` : ""}Unscheduled · {formatEffortDays(phase.effortDays)}</button>}</div>)}</div>;
          })}
        </section>}
      </div>
    </div>
  );
}

export function CodexBoard({
  intent,
  result,
  initialClock,
}: {
  intent: ScheduleIntent;
  result: ScheduleResult;
  initialClock: string;
}) {
  const router = useRouter();
  const [lens, setLens] = useState<Lens>("team");
  const [horizon, setHorizon] = useState<Horizon>(8);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [showProjectName, setShowProjectName] = useState(true);
  const [selection, setSelection] = useState<InspectorSelection>(null);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const [updated, setUpdated] = useState(false);
  const [clock, setClock] = useState(() => new Date(initialClock));
  const [copied, setCopied] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const colors = useMemo(() => new Map(intent.projects.map((project, index) => [project.id, projectInk(project.color ?? index)])), [intent.projects]);
  const sortedSprints = useMemo(() => [...intent.sprints].sort((a, b) => a.startDate.localeCompare(b.startDate)), [intent.sprints]);
  const planning = sortedSprints.slice(result.planningStartIndex);
  const visibleSprints = horizon === "all" ? planning : planning.slice(0, horizon);

  const refresh = useCallback(() => {
    setUpdated(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setUpdated(false), 2400);
    router.refresh();
    setClock(new Date());
  }, [router]);

  useEffect(() => {
    const source = new EventSource("/api/watch");
    source.onopen = () => setLive("live");
    source.onmessage = (event) => { if (event.data === "reload") refresh(); };
    source.onerror = () => setLive("offline");
    const interval = window.setInterval(() => setClock(new Date()), 30_000);
    return () => { source.close(); window.clearInterval(interval); if (flashTimer.current) window.clearTimeout(flashTimer.current); };
  }, [refresh]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelection(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const snapshot = useMemo(() => {
    const lines = intent.projects.map((project) => {
      const timelines = result.phaseTimelines.filter((item) => item.projectId === project.id && !item.unscheduled);
      const end = timelines.map((item) => item.endSprintId).filter(Boolean).sort((a, b) => sortedSprints.findIndex((sprint) => sprint.id === a) - sortedSprints.findIndex((sprint) => sprint.id === b)).at(-1);
      return `${project.code} ${project.name} · P${project.priority} · ends ${sortedSprints.find((sprint) => sprint.id === end)?.name ?? "Not placed"}`;
    });
    const unscheduled = result.phaseTimelines.filter((item) => item.unscheduled).map((item) => intent.phases.find((phase) => phase.id === item.phaseId)?.name).filter(Boolean);
    if (unscheduled.length) lines.push(`Unscheduled: ${unscheduled.join(", ")}`);
    return lines.join("\n");
  }, [intent, result, sortedSprints]);

  return (
    <main className="min-h-dvh bg-[#f4f0e6] text-stone-900">
      <div className="flex min-h-dvh">
        <div className="min-w-0 flex-1">
          <header className="border-b border-stone-300 bg-[#f8f4eb] px-5 py-5 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div><p className="font-mono text-[10px] tracking-[0.2em] text-stone-500 uppercase">Local planning desk · /codex</p><h1 className="font-heading mt-1 text-4xl leading-none">Sprint planner</h1><p className="mt-2 text-sm text-stone-600">The Codex board · computed from shared SQLite intent</p></div>
              <div className="flex items-center gap-3 text-xs">
                {updated && <span className="bg-amber-200 px-2 py-1 font-mono text-[10px]">Plan updated</span>}
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] ${live === "offline" ? "border-amber-600 bg-amber-100 text-amber-900" : "border-stone-300 bg-white/50"}`}><span className={`size-1.5 rounded-full ${live === "live" ? "bg-emerald-600" : live === "offline" ? "bg-amber-600" : "bg-stone-400"}`} />{live}</span>
                <span className="font-mono text-[10px] text-stone-500">planner.sqlite · {clock.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Australia/Melbourne" })}</span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-stone-300 bg-white/50 p-0.5">{(["team", "projects"] as Lens[]).map((item) => <button key={item} type="button" onClick={() => setLens(item)} className={`rounded px-3 py-1 text-xs capitalize ${lens === item ? "bg-stone-900 text-[#f4f0e6]" : "hover:bg-stone-100"}`}>{item}</button>)}</div>
              <div className="flex rounded-md border border-stone-300 bg-white/50 p-0.5">{([6, 8, 12, "all"] as Horizon[]).map((item) => <button key={item} type="button" onClick={() => setHorizon(item)} className={`rounded px-2 py-1 font-mono text-[10px] capitalize ${horizon === item ? "bg-stone-700 text-white" : "hover:bg-stone-100"}`}>{item === "all" ? "All" : item}</button>)}</div>
              <MultiFilter kind="Projects" items={intent.projects} selected={selectedProjects} onChange={setSelectedProjects} colors={colors} />
              <MultiFilter kind="People" items={intent.engineers} selected={selectedPeople} onChange={setSelectedPeople} />
              <HighlightMenu projects={intent.projects} value={highlight} onChange={setHighlight} colors={colors} />
              <ViewMenu showProjectName={showProjectName} onShowProjectNameChange={setShowProjectName} />
              <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(snapshot); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy snapshot"}</Button>
              <Button variant="outline" size="sm" onClick={refresh}><RefreshCw />Refresh</Button>
            </div>
          </header>

          {result.alerts.length > 0 && <div className="border-b border-red-200 bg-red-50 px-5 py-2 lg:px-8"><details className="text-xs"><summary className="flex cursor-pointer list-none items-center gap-2"><Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" />{result.alerts.length}</Badge><span>{result.alerts[0].message}</span><span className="ml-auto font-mono text-[10px] text-red-800">All alerts</span></summary><div className="mt-2 divide-y divide-red-200 border-t border-red-200">{result.alerts.map((alert) => <button key={alert.id} type="button" className="block w-full px-1 py-2 text-left hover:bg-red-100" onClick={() => alert.phaseId ? setSelection({ type: "phase", phaseId: alert.phaseId }) : alert.engineerId && alert.sprintId ? setSelection({ type: "idle", engineerId: alert.engineerId, sprintId: alert.sprintId }) : undefined}>{alert.message}</button>)}</div></details></div>}

          <section className="py-5">
            <div className="mb-3 flex items-center justify-between px-5 lg:px-8"><p className="font-mono text-[10px] tracking-[0.16em] text-stone-500 uppercase">{lens === "team" ? "Capacity by person" : "Delivery by initiative"} · {visibleSprints.length} sprint horizon</p><p className="hidden font-mono text-[9px] text-stone-400 sm:block">← → scroll · esc closes inspector</p></div>
            {lens === "team" ? <TeamGrid intent={intent} result={result} sprints={visibleSprints} selectedPeople={selectedPeople} selectedProjects={selectedProjects} highlight={highlight} onSelection={setSelection} onPersonClick={(id) => setSelectedPeople((current) => current.length === 1 && current[0] === id ? [] : [id])} colors={colors} showProjectName={showProjectName} /> : <ProjectsGrid intent={intent} result={result} sprints={visibleSprints} selectedProjects={selectedProjects} selectedPeople={selectedPeople} highlight={highlight} setHighlight={setHighlight} onSelection={setSelection} colors={colors} showProjectName={showProjectName} />}
          </section>
        </div>
        {selection && <Inspector selection={selection} onClose={() => setSelection(null)} intent={intent} result={result} projectColors={colors} />}
      </div>
    </main>
  );
}
