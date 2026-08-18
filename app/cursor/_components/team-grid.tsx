"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Engineer, Phase, Project, Sprint } from "@/lib/schema";
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
}) {
  const labels = plannerLabels(roster);

  return (
    <div
      className="grid min-w-max"
      style={{
        gridTemplateColumns: `repeat(${sprints.length + 1}, minmax(112px, 1fr))`,
      }}
    >
      <div className="sticky left-0 z-20 border-b border-stone-300 bg-[#efeae0]" />
      {sprints.map((sprint) => {
        const current = sprint.id === currentSprintId;
        return (
          <div
            key={sprint.id}
            className={cn(
              "border-b border-l border-stone-300 px-2 py-2",
              current && "bg-[#e8d7a8]/50",
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

      {engineers.map((engineer) => (
        <EngineerRow
          key={engineer.id}
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
        />
      ))}
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
}) {
  const working = sprint.workingDays;
  const ptoPct = ((load?.timeOffDays ?? 0) / working) * 100;
  const unavailablePct =
    ((working - (load?.timeOffDays ?? 0) - (load?.capacityDays ?? 0)) / working) * 100;
  const rows = packRequestedRows(segments, working);
  const stacked = rows.length > 1;

  return (
    <div
      className={cn(
        "relative flex border-b border-l border-stone-300",
        stacked ? "min-h-[4.5rem] flex-col" : "h-14",
        current && "bg-[#e8d7a8]/20",
      )}
    >
      <div className={cn("flex min-h-0 flex-1", stacked ? "flex-col" : "flex-row")}>
        {ptoPct > 0.5 && (
          <div
            className="flex items-center justify-center border-r border-stone-400/40 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,#c4b8a0_3px,#c4b8a0_4px)] text-[9px] text-stone-600"
            style={{ width: `${ptoPct}%` }}
            title={`PTO ${load?.timeOffDays}d`}
          >
            PTO
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex min-h-7 flex-1">
              {row.map((seg) => (
                <SegmentButton
                  key={`${seg.phaseId}:${seg.engineerId}`}
                  seg={seg}
                  workingDays={working}
                  engineer={engineer}
                  projects={projects}
                  phases={phases}
                  highlightProjectId={highlightProjectId}
                  selected={selected}
                  onSelect={onSelect}
                  projectIndex={projectIndex}
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
                  style={{ width: `${((load?.idleDays ?? 0) / working) * 100}%` }}
                >
                  <span className="px-1">idle {load?.idleDays.toFixed(0)}d</span>
                </button>
              )}
              {rowIdx === rows.length - 1 && unavailablePct > 0.5 && (
                <div
                  className="h-full bg-stone-300/50"
                  style={{ width: `${unavailablePct}%` }}
                  title="Below 1.0 FTE"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {load?.overloaded && (
        <span className="absolute top-0.5 right-0.5 z-10 rounded-sm bg-[#9a3412] px-1 text-[9px] font-medium text-white">
          {Math.round(load.requestedFractionSum * 100)}%
        </span>
      )}
    </div>
  );
}

function barWidth(seg: CellSegment, workingDays: number) {
  if (seg.unfilled) return seg.requestedFraction;
  if (workingDays <= 0) return 0;
  return seg.days / workingDays;
}

function packRequestedRows(segments: CellSegment[], workingDays: number): CellSegment[][] {
  if (segments.length === 0) return [[]];
  const ordered = [...segments].sort((a, b) => {
    if (a.unfilled !== b.unfilled) return a.unfilled ? 1 : -1;
    return barWidth(b, workingDays) - barWidth(a, workingDays);
  });
  const rows: CellSegment[][] = [];
  let current: CellSegment[] = [];
  let used = 0;
  for (const seg of ordered) {
    const width = barWidth(seg, workingDays);
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
  workingDays,
  engineer,
  projects,
  phases,
  highlightProjectId,
  selected,
  onSelect,
  projectIndex,
}: {
  seg: CellSegment;
  workingDays: number;
  engineer: Engineer;
  projects: Project[];
  phases: Phase[];
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  projectIndex: Map<string, number>;
}) {
  const phase = phases.find((p) => p.id === seg.phaseId);
  const project = projects.find((p) => p.id === seg.projectId);
  const ink = projectInk(projectIndex.get(seg.projectId) ?? 0);
  const dim = highlightProjectId != null && highlightProjectId !== seg.projectId;
  const isSelected = selected?.kind === "phase" && selected.phaseId === seg.phaseId;
  const widthFrac = barWidth(seg, workingDays);
  const labelPct = Math.round(
    (seg.unfilled ? seg.requestedFraction : widthFrac) * 100,
  );

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
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}
