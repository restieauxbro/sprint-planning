"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Engineer, Phase, Project, Sprint } from "@/lib/schema";
import { peopleInViewSection, type ViewSection } from "@/lib/saved-views";
import { cn } from "@/lib/utils";
import type { CellSegment, EngineerSprintLoad } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";
import { initials, phaseLabel, plannerLabels, projectInk } from "./colors";
import type { Selection } from "./selection";

export function TeamGrid({
  engineers,
  roster,
  sprints,
  projects,
  phases,
  segments,
  loads,
  currentSprintId,
  highlightProjectId,
  selected,
  onSelect,
  onToggleEngineer,
  projectIndex,
  showProjectName,
  sections,
}: {
  engineers: Engineer[];
  roster: Engineer[];
  sprints: Sprint[];
  projects: Project[];
  phases: Phase[];
  segments: CellSegment[];
  loads: EngineerSprintLoad[];
  currentSprintId: string | null;
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  onToggleEngineer: (id: string) => void;
  projectIndex: Map<string, number>;
  showProjectName: boolean;
  sections: ViewSection[];
}) {
  const labels = plannerLabels(roster);
  const groupedPeople = sections.map((section) => ({
    section,
    people: peopleInViewSection(section, sections, engineers),
  })).filter((group) => group.people.length > 0);

  return (
    <div
      className="grid min-w-max"
      style={{
        gridTemplateColumns: `112px repeat(${sprints.length}, minmax(112px, 1fr))`,
      }}
    >
      <div className="sticky top-0 left-0 z-30 border-b border-stone-300 bg-[#efeae0]" />
      {sprints.map((sprint) => {
        const current = sprint.id === currentSprintId;
        return (
          <div
            key={sprint.id}
            className={cn(
              "sticky top-0 z-20 border-b border-l border-stone-300 bg-[#efeae0] px-2 py-2",
              current && "bg-stone-100",
            )}
          >
            <p className="font-mono text-[11px] tracking-wide text-stone-600">
              {sprint.name}
              {current && (
                <span className="ml-1 rounded-sm bg-[#c4a35a] px-1 py-px text-[9px] font-medium text-[#2b2414] uppercase">
                  now
                </span>
              )}
            </p>
            <p className="text-[10px] text-stone-500">
              {formatShortDate(sprint.startDate)} – {formatShortDate(sprint.endDate)}
            </p>
          </div>
        );
      })}

      {(sections.length ? groupedPeople : [{ section: null, people: engineers }]).flatMap(({ section, people }) => [
        section ? (
          <div key={`${section.id}-divider`} style={{ gridColumn: "1 / -1" }} className="border-b border-stone-300 bg-[#f4f0e6]">
            <div className="sticky left-0 z-10 flex w-fit min-w-[112px] items-center gap-2 bg-[#f4f0e6] px-3 py-1.5">
              <span className="font-heading text-sm font-medium text-stone-800">{section.name}</span>
              <span className="font-mono text-[10px] text-stone-500">{people.length}</span>
            </div>
          </div>
        ) : null,
        ...people.map((engineer) => (
          <EngineerRow
            key={`${section?.id ?? "all"}-${engineer.id}`}
            engineer={engineer}
            label={labels.get(engineer.id) ?? engineer.name.trim().split(/\s+/)[0]!}
            sprints={sprints}
            projects={projects}
            phases={phases}
            segments={segments.filter((s) => s.engineerId === engineer.id)}
            loads={loads.filter((l) => l.engineerId === engineer.id)}
            currentSprintId={currentSprintId}
            highlightProjectId={highlightProjectId}
            selected={selected}
            onSelect={onSelect}
            onToggleEngineer={onToggleEngineer}
            projectIndex={projectIndex}
            showProjectName={showProjectName}
          />
        )),
      ])}
    </div>
  );
}

function EngineerRow({
  engineer,
  label,
  sprints,
  projects,
  phases,
  segments,
  loads,
  currentSprintId,
  highlightProjectId,
  selected,
  onSelect,
  onToggleEngineer,
  projectIndex,
  showProjectName,
}: {
  engineer: Engineer;
  label: string;
  sprints: Sprint[];
  projects: Project[];
  phases: Phase[];
  segments: CellSegment[];
  loads: EngineerSprintLoad[];
  currentSprintId: string | null;
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  onToggleEngineer: (id: string) => void;
  projectIndex: Map<string, number>;
  showProjectName: boolean;
}) {
  return (
    <>
      <button
        type="button"
        title={engineer.name}
        onClick={() => onToggleEngineer(engineer.id)}
        className="sticky left-0 z-10 border-b border-stone-300 bg-[#f4f0e6] px-3 py-2 text-left whitespace-nowrap hover:bg-[#ebe4d4]"
      >
        <p className="text-sm font-medium text-stone-900">{label}</p>
        <p className="font-mono text-[10px] text-stone-500">{engineer.fte.toFixed(1)} FTE</p>
      </button>
      {sprints.map((sprint) => {
        const load = loads.find((l) => l.sprintId === sprint.id);
        const cellSegs = segments.filter((s) => s.sprintId === sprint.id);
        return (
          <CapacityCell
            key={sprint.id}
            sprint={sprint}
            engineer={engineer}
            load={load}
            segments={cellSegs}
            projects={projects}
            phases={phases}
            current={sprint.id === currentSprintId}
            highlightProjectId={highlightProjectId}
            selected={selected}
            onSelect={onSelect}
            projectIndex={projectIndex}
            showProjectName={showProjectName}
          />
        );
      })}
    </>
  );
}

function CapacityCell({
  sprint,
  engineer,
  load,
  segments,
  projects,
  phases,
  current,
  highlightProjectId,
  selected,
  onSelect,
  projectIndex,
  showProjectName,
}: {
  sprint: Sprint;
  engineer: Engineer;
  load?: EngineerSprintLoad;
  segments: CellSegment[];
  projects: Project[];
  phases: Phase[];
  current: boolean;
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  projectIndex: Map<string, number>;
  showProjectName: boolean;
}) {
  const working = sprint.workingDays;
  const ptoPct = ((load?.timeOffDays ?? 0) / working) * 100;
  const capacityPct = ((load?.capacityDays ?? 0) / working) * 100;
  const leaveAtEnd = load?.timeOffPlacement === "end";
  const unavailablePct =
    ((working - (load?.timeOffDays ?? 0) - (load?.capacityDays ?? 0)) / working) * 100;
  // Queued work has no physical place in a fully unavailable sprint. Rendering it
  // beside 100% leave forces the flex layout to squeeze it into misleading slivers.
  const visibleSegments = (load?.capacityDays ?? 0) > 0 ? segments : [];
  const rows = packRequestedRows(visibleSegments, load?.capacityDays ?? 0);
  const stacked = rows.length > 1;

  const leave = ptoPct > 0.5 && (
    <div
      className="flex items-center justify-center border-r border-stone-400/40 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,#c4b8a0_3px,#c4b8a0_4px)] text-[9px] text-stone-600"
      style={{ width: `${ptoPct}%` }}
      title={`Leave ${load?.timeOffDays}d`}
    >
      Leave
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex border-b border-l border-stone-300",
        stacked ? "min-h-[4.5rem] flex-col" : "h-14",
        current && "bg-[#e8d7a8]/20",
      )}
    >
      <div className={cn("flex min-h-0 flex-1", stacked ? "flex-col" : "flex-row")}>
        {!leaveAtEnd && leave}
        <div className="flex min-h-0 min-w-0 flex-col" style={{ width: `${capacityPct}%` }}>
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex min-h-7 flex-1">
              {row.map((seg) => (
                <SegmentButton
                  key={`${seg.phaseId}:${seg.engineerId}`}
                  seg={seg}
                  capacityDays={load?.capacityDays ?? 0}
                  engineer={engineer}
                  projects={projects}
                  phases={phases}
                  highlightProjectId={highlightProjectId}
                  selected={selected}
                  onSelect={onSelect}
                  projectIndex={projectIndex}
                  showProjectName={showProjectName}
                />
              ))}
              {rowIdx === rows.length - 1 && (load?.idleDays ?? 0) > 0.05 && (
                <button
                  type="button"
                  onClick={() =>
                    onSelect({ kind: "idle", engineerId: engineer.id, sprintId: sprint.id })
                  }
                  className={cn(
                    "h-full bg-[#f4f0e6] text-left text-[10px] text-stone-400 hover:bg-[#ece6d8]",
                    selected?.kind === "idle" &&
                      selected.engineerId === engineer.id &&
                      selected.sprintId === sprint.id &&
                      "ring-2 ring-inset ring-stone-900",
                  )}
                  style={{ width: `${((load?.idleDays ?? 0) / (load?.capacityDays ?? 1)) * 100}%` }}
                >
                  <span className="px-1">idle {load?.idleDays.toFixed(0)}d</span>
                </button>
              )}
            </div>
          ))}
        </div>
        {leaveAtEnd && leave}
        {unavailablePct > 0.5 && (
          <div
            className="h-full bg-stone-300/50"
            style={{ width: `${unavailablePct}%` }}
            title="Below 1.0 FTE"
          />
        )}
      </div>
      {load?.overloaded && (
        <span className="absolute top-0.5 right-0.5 z-10 rounded-sm bg-[#9a3412] px-1 text-[9px] font-medium text-white">
          {Math.round(load.requestedFractionSum * 100)}%
        </span>
      )}
    </div>
  );
}

function barWidth(seg: CellSegment, capacityDays: number) {
  if (seg.unfilled) return seg.requestedFraction;
  if (capacityDays <= 0) return 0;
  return seg.days / capacityDays;
}

function packRequestedRows(segments: CellSegment[], capacityDays: number): CellSegment[][] {
  if (segments.length === 0) return [[]];
  const ordered = [...segments].sort((a, b) => {
    if (a.unfilled !== b.unfilled) return a.unfilled ? 1 : -1;
    return barWidth(b, capacityDays) - barWidth(a, capacityDays);
  });
  const rows: CellSegment[][] = [];
  let current: CellSegment[] = [];
  let used = 0;
  for (const seg of ordered) {
    const width = barWidth(seg, capacityDays);
    if (current.length > 0 && used + width > 1.001) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(seg);
    used += width;
  }
  if (current.length) rows.push(current);
  return rows;
}

function SegmentButton({
  seg,
  capacityDays,
  engineer,
  projects,
  phases,
  highlightProjectId,
  selected,
  onSelect,
  projectIndex,
  showProjectName,
}: {
  seg: CellSegment;
  capacityDays: number;
  engineer: Engineer;
  projects: Project[];
  phases: Phase[];
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  projectIndex: Map<string, number>;
  showProjectName: boolean;
}) {
  const phase = phases.find((p) => p.id === seg.phaseId);
  const project = projects.find((p) => p.id === seg.projectId);
  const ink = projectInk(project?.color ?? projectIndex.get(seg.projectId) ?? 0);
  const dim = highlightProjectId != null && highlightProjectId !== seg.projectId;
  const isSelected = selected?.kind === "phase" && selected.phaseId === seg.phaseId;
  const widthFrac = barWidth(seg, capacityDays);
  const labelPct = Math.round(seg.requestedFraction * 100);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={() => onSelect({ kind: "phase", phaseId: seg.phaseId })}
        className={cn(
          "h-full min-w-0 truncate px-1 text-left text-[11px] leading-tight ring-inset transition-opacity",
          isSelected && "ring-2 ring-stone-900",
          dim && "opacity-25",
        )}
        style={{
          width: `${widthFrac * 100}%`,
          backgroundColor: ink.fill,
          backgroundImage: seg.unfilled
            ? "repeating-linear-gradient(-45deg, transparent, transparent 3px, rgb(0 0 0 / 0.14) 3px, rgb(0 0 0 / 0.14) 4px)"
            : undefined,
          color: ink.ink,
        }}
      >
        <span className="block truncate font-medium">
          {showProjectName && project ? `${project.name} · ` : ""}
          {project && phase ? phaseLabel(project, phase) : phase?.name}
        </span>
        <span className="block truncate text-[9px] opacity-80">
          {initials(engineer.name)} {labelPct}%
          {seg.unfilled ? " queued" : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">
          {project && phase ? phaseLabel(project, phase) : `${project?.name} · ${phase?.name}`}
        </p>
        {seg.unfilled ? (
          <p>
            {Math.round(seg.requestedFraction * 100)}% requested this sprint, 0d delivered —
            queued behind higher-priority work.
          </p>
        ) : (
          <p>
            {seg.days.toFixed(1)}d this sprint · {Math.round(seg.requestedFraction * 100)}%
            requested
          </p>
        )}
        {phase && <p>Sized {formatEffortDays(phase.effortDays)}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function formatShortDate(iso: string) {
  const [, , d] = iso.split("-");
  const monthName = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  return `${d} ${monthName}`;
}
