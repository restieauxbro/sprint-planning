"use client";

import type { Assignment, Engineer, Phase, Project, Sprint } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import type { PhaseTimeline } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";
import { plannerLabels, projectCode, projectInk } from "./colors";
import type { Selection } from "./selection";

export function ProjectGrid({
  projects,
  phases,
  engineers,
  assignments,
  sprints,
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
      <div className="sticky top-0 left-0 z-30 border-b border-stone-300 bg-[#efeae0]" />
      {sprints.map((sprint) => (
        <div
          key={sprint.id}
          className={cn(
            "sticky top-0 z-20 border-b border-l border-stone-300 bg-[#efeae0] px-2 py-2",
            sprint.id === currentSprintId && "bg-stone-100",
          )}
        >
          <p className="font-mono text-[11px] text-stone-600">{sprint.name}</p>
          <p className="font-mono text-[9px] text-stone-500">
            {formatShortDate(sprint.startDate)} – {formatShortDate(sprint.endDate)}
          </p>
        </div>
      ))}

      {scheduled.map(({ project, phases: projectPhases }) => {
        const ink = projectInk(project.color ?? projectIndex.get(project.id) ?? 0);
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
              className="sticky left-0 z-20 flex items-start gap-1 border-b border-stone-300 bg-[#ebe4d4] px-2 py-2 text-left"
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
                  <span className="inline-flex min-w-6 shrink-0 justify-center text-[13px] leading-none">
                    {projectCode(project)}
                  </span>
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
                  "border-b border-l border-stone-300",
                  sprint.id === currentSprintId ? "bg-transparent" : "bg-[#ebe4d4]/40",
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
                timeline={timelines.find((t) => t.phaseId === phase.id)}
                currentSprintId={currentSprintId}
                highlightProjectId={highlightProjectId}
                selected={selected}
                onSelect={onSelect}
                ink={projectInk(project?.color ?? projectIndex.get(phase.projectId) ?? 0)}
                unscheduled
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function formatShortDate(iso: string) {
  const [, , day] = iso.split("-");
  const monthName = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  return `${day} ${monthName}`;
}

function PhaseRow({
  phase,
  project,
  engineers,
  assignments,
  sprints,
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
  const peopleByFraction = new Map<number, string[]>();
  for (const assignment of assignments) {
    const names = peopleByFraction.get(assignment.fraction) ?? [];
    names.push(labels.get(assignment.engineerId) ?? assignment.engineerId);
    peopleByFraction.set(assignment.fraction, names);
  }
  const people = [...peopleByFraction.entries()]
    .map(([fraction, names]) => `${names.join(" & ")} ${Math.round(fraction * 100)}%`)
    .join(", ");

  return (
    <div
      className="col-span-full grid"
      style={{ gridTemplateColumns: `220px repeat(${sprints.length}, minmax(112px, 1fr))` }}
    >
      <button
        type="button"
        onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
        className="sticky left-0 z-20 border-b border-stone-300 bg-[#f4f0e6] px-3 py-2 text-left hover:bg-[#ebe4d4]"
      >
        <p className="text-[13px] text-stone-800">{phase.name}</p>
        <p className="font-mono text-[10px] text-stone-500">
          {formatEffortDays(phase.effortDays)}
          {unscheduled ? " · no one" : ""}
        </p>
      </button>
      {sprints.map((sprint, idx) => {
        return (
          <div
            key={sprint.id}
            className={cn(
              "relative h-12 border-b border-l border-stone-300",
              sprint.id === currentSprintId && "bg-transparent",
            )}
            style={{ gridColumn: idx + 2, gridRow: 1 }}
          >
          </div>
        );
      })}
      {startIdx >= 0 && endIdx >= startIdx && (
        <button
          type="button"
          onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
          title={`${project.name} · ${phase.name}\n${people || "Unassigned"}`}
          className={cn(
            "z-10 mx-1 my-1.5 min-w-0 truncate rounded-sm px-1.5 text-left text-[11px]",
            isSelected && "ring-2 ring-stone-900",
            dim && "opacity-25",
          )}
          style={{
            gridColumn: `${startIdx + 2} / ${endIdx + 3}`,
            gridRow: 1,
            background: ink.fill,
            color: ink.ink,
          }}
        >
          {people || phase.name}
        </button>
      )}
      {unscheduled && (
        <button
          type="button"
          onClick={() => onSelect({ kind: "phase", phaseId: phase.id })}
          className="z-10 mx-1 my-1.5 truncate rounded-sm border border-dashed border-[#9a3412] px-1.5 text-left text-[11px] text-[#9a3412]"
          style={{ gridColumn: "2 / 3", gridRow: 1 }}
        >
          Unscheduled · {formatEffortDays(phase.effortDays)}
        </button>
      )}
    </div>
  );
}
