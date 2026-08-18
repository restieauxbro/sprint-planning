"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Assignment, Engineer, Phase, Project, Sprint } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import type { CellSegment, PhaseTimeline } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";
import { phaseLabel, plannerLabels, projectCode, projectInk } from "./colors";
import type { Selection } from "./selection";

export function ProjectGrid({
  projects,
  phases,
  engineers,
  assignments,
  sprints,
  segments,
  timelines,
  currentSprintId,
  highlightProjectId,
  selected,
  onSelect,
  onHighlight,
  projectIndex,
}: {
  projects: Project[];
  phases: Phase[];
  engineers: Engineer[];
  assignments: Assignment[];
  sprints: Sprint[];
  segments: CellSegment[];
  timelines: PhaseTimeline[];
  currentSprintId: string | null;
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  onHighlight: (projectId: string) => void;
  projectIndex: Map<string, number>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scheduled = projects.map((project) => ({
    project,
    phases: phases
      .filter((p) => p.projectId === project.id)
      .filter((p) => !timelines.find((t) => t.phaseId === p.id)?.unscheduled)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  const unscheduledPhases = timelines
    .filter((t) => t.unscheduled)
    .map((t) => phases.find((p) => p.id === t.phaseId)!)
    .filter(Boolean);

  return (
    <div
      className="grid min-w-max"
      style={{
        gridTemplateColumns: `220px repeat(${sprints.length}, minmax(112px, 1fr))`,
      }}
    >
      <div className="sticky left-0 z-20 border-b border-stone-300 bg-[#efeae0]" />
      {sprints.map((sprint) => (
        <div
          key={sprint.id}
          className={cn(
            "border-b border-l border-stone-300 px-2 py-2",
            sprint.id === currentSprintId && "bg-[#e8d7a8]/50",
          )}
        >
          <p className="font-mono text-[11px] text-stone-600">{sprint.name}</p>
        </div>
      ))}

      {scheduled.map(({ project, phases: projectPhases }) => {
        const ink = projectInk(projectIndex.get(project.id) ?? 0);
        const isCollapsed = collapsed.has(project.id);
        const ends = projectPhases
          .map((p) => timelines.find((t) => t.phaseId === p.id)?.endSprintId)
          .filter(Boolean);
        const lastEnd = ends
          .map((id) => sprints.find((s) => s.id === id))
          .filter(Boolean)
          .sort((a, b) => (a!.startDate < b!.startDate ? 1 : -1))[0];
        const remaining = projectPhases.reduce((sum, p) => {
          const t = timelines.find((x) => x.phaseId === p.id);
          return sum + (t?.remainingDays ?? p.effortDays);
        }, 0);

        return (
          <div key={project.id} className="contents">
            <button
              type="button"
              onClick={() => onHighlight(project.id)}
              className="sticky left-0 z-10 flex items-start gap-1 border-b border-stone-300 bg-[#ebe4d4] px-2 py-2 text-left"
            >
              <span
                role="presentation"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(project.id)) next.delete(project.id);
                    else next.add(project.id);
                    return next;
                  });
                }}
                className="mt-0.5 text-stone-500"
              >
                {isCollapsed ? (
                  <ChevronRightIcon className="size-3.5" />
                ) : (
                  <ChevronDownIcon className="size-3.5" />
                )}
              </span>
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="size-2 rounded-sm" style={{ background: ink.fill }} />
                  <span className="font-mono text-[11px]">{projectCode(project)}</span>
                  {project.name}
                </span>
                <span className="block font-mono text-[10px] text-stone-500">
                  P{project.priority} · {formatEffortDays(remaining)} left · ends{" "}
                  {lastEnd?.name ?? "—"}
                </span>
              </span>
            </button>
            {sprints.map((sprint) => (
              <div
                key={sprint.id}
                className={cn(
                  "border-b border-l border-stone-300 bg-[#ebe4d4]/40",
                  sprint.id === currentSprintId && "bg-[#e8d7a8]/30",
                )}
              />
            ))}
            {!isCollapsed &&
              projectPhases.map((phase) => (
                <PhaseRow
                  key={phase.id}
                  phase={phase}
                  project={project}
                  engineers={engineers}
                  assignments={assignments.filter((a) => a.phaseId === phase.id)}
                  sprints={sprints}
                  segments={segments.filter((s) => s.phaseId === phase.id)}
                  timeline={timelines.find((t) => t.phaseId === phase.id)}
                  currentSprintId={currentSprintId}
                  highlightProjectId={highlightProjectId}
                  selected={selected}
                  onSelect={onSelect}
                  ink={ink}
                />
              ))}
          </div>
        );
      })}

      {unscheduledPhases.length > 0 && (
        <>
          <div className="sticky left-0 z-10 border-b border-stone-300 bg-[#f3e4d4] px-3 py-2">
            <p className="text-sm font-medium text-[#9a3412]">Unscheduled</p>
            <p className="font-mono text-[10px] text-stone-500">
              Effort with nobody assigned
            </p>
          </div>
          {sprints.map((sprint) => (
            <div
              key={sprint.id}
              className="border-b border-l border-stone-300 bg-[#f3e4d4]/50"
            />
          ))}
          {unscheduledPhases.map((phase) => {
            const project = projects.find((p) => p.id === phase.projectId);
            return (
              <PhaseRow
                key={phase.id}
                phase={phase}
                project={project!}
                engineers={engineers}
                assignments={[]}
                sprints={sprints}
                segments={[]}
                timeline={timelines.find((t) => t.phaseId === phase.id)}
                currentSprintId={currentSprintId}
                highlightProjectId={highlightProjectId}
                selected={selected}
                onSelect={onSelect}
                ink={projectInk(projectIndex.get(phase.projectId) ?? 0)}
                unscheduled
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function PhaseRow({
  phase,
  project,
  engineers,
  assignments,
  sprints,
  segments,
  timeline,
  currentSprintId,
  highlightProjectId,
  selected,
  onSelect,
  ink,
  unscheduled,
}: {
  phase: Phase;
  project: Project;
  engineers: Engineer[];
  assignments: Assignment[];
  sprints: Sprint[];
  segments: CellSegment[];
  timeline?: PhaseTimeline;
  currentSprintId: string | null;
  highlightProjectId: string | null;
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
  ink: { fill: string; ink: string };
  unscheduled?: boolean;
}) {
  const startIdx = timeline?.startSprintId
    ? sprints.findIndex((s) => s.id === timeline.startSprintId)
    : -1;
  const endIdx = timeline?.endSprintId
    ? sprints.findIndex((s) => s.id === timeline.endSprintId)
    : -1;
  const dim = highlightProjectId != null && highlightProjectId !== project.id;
  const isSelected = selected?.kind === "phase" && selected.phaseId === phase.id;
  const labels = plannerLabels(engineers);
  const people = assignments
    .map((a) => {
      const label = labels.get(a.engineerId) ?? a.engineerId;
      return `${label} ${Math.round(a.fraction * 100)}%`;
    })
    .join(" · ");

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
        className="sticky left-0 z-10 border-b border-stone-300 bg-[#f4f0e6] px-3 py-2 text-left hover:bg-[#ebe4d4]"
      >
        <p className="text-[13px] text-stone-800">{phaseLabel(project, phase)}</p>
        <p className="font-mono text-[10px] text-stone-500">
          {formatEffortDays(phase.effortDays)}
          {unscheduled ? " · no one" : ""}
        </p>
      </button>
      {sprints.map((sprint, idx) => {
        const inBar = startIdx >= 0 && idx >= startIdx && idx <= endIdx;
        const first = idx === startIdx;
        return (
          <div
            key={sprint.id}
            className={cn(
              "relative h-12 border-b border-l border-stone-300",
              sprint.id === currentSprintId && "bg-[#e8d7a8]/20",
            )}
          >
            {inBar && (
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
                  className={cn(
                    "absolute inset-y-1.5 left-0 right-0 text-left text-[11px]",
                    first ? "rounded-l-sm px-1.5" : "",
                    idx === endIdx ? "rounded-r-sm" : "",
                    isSelected && "ring-2 ring-stone-900",
                    dim && "opacity-25",
                  )}
                  style={{ background: ink.fill, color: ink.ink }}
                >
                  {first ? (
                    <span className="block truncate">
                      {people || phaseLabel(project, phase)}
                    </span>
                  ) : null}
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {project.name} · {phaseLabel(project, phase)}
                  </p>
                  <p>{people || "Unassigned"}</p>
                  {segments
                    .filter((s) => s.sprintId === sprint.id)
                    .map((s) => (
                      <p key={s.engineerId}>
                        {s.days.toFixed(1)}d · {Math.round(s.allocatedFraction * 100)}%
                      </p>
                    ))}
                </TooltipContent>
              </Tooltip>
            )}
            {unscheduled && idx === 0 && (
              <button
                type="button"
                onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
                className="absolute inset-y-1.5 left-1 right-1 truncate rounded-sm border border-dashed border-[#9a3412] px-1.5 text-left text-[11px] text-[#9a3412]"
              >
                Unscheduled · {formatEffortDays(phase.effortDays)}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
