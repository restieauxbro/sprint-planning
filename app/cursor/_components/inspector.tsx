"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Assignment, Engineer, Phase, Project, Sprint } from "@/lib/schema";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { EngineerSprintLoad, PhaseTimeline } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";
import { phaseLabel, projectCode, projectInk } from "./colors";
import type { Selection } from "./selection";

function CopySlug({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="font-mono inline-flex items-center gap-1.5 rounded-sm bg-stone-200/80 px-1.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-300"
    >
      {value}
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </button>
  );
}

export function Inspector({
  selection,
  onClose,
  intent,
  timelines,
  loads,
  sprints,
  projectIndex,
}: {
  selection: Selection;
  onClose: () => void;
  intent: {
    engineers: Engineer[];
    projects: Project[];
    phases: Phase[];
    assignments: Assignment[];
    sprints: Sprint[];
  };
  timelines: PhaseTimeline[];
  loads: EngineerSprintLoad[];
  sprints: Sprint[];
  projectIndex: Map<string, number>;
}) {
  if (selection.kind === "idle") {
    const engineer = intent.engineers.find((e) => e.id === selection.engineerId);
    const sprint = sprints.find((s) => s.id === selection.sprintId);
    const load = loads.find(
      (l) => l.engineerId === selection.engineerId && l.sprintId === selection.sprintId,
    );
    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-stone-300 bg-[#f7f3ea]">
        <Header title="Idle capacity" onClose={onClose} />
        <div className="space-y-3 overflow-y-auto p-4 text-sm">
          <p>
            {engineer?.name} has {load?.idleDays.toFixed(1)} idle days in {sprint?.name}.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {engineer && <CopySlug value={engineer.id} />}
            {sprint && <CopySlug value={sprint.id} />}
          </div>
          <p className="text-stone-600">
            Assign an unscheduled phase, or raise a fraction on work that is waiting.
          </p>
        </div>
      </aside>
    );
  }

  const phaseId = selection.phaseId;
  const phase = intent.phases.find((p) => p.id === phaseId);
  const project = intent.projects.find((p) => p.id === phase?.projectId);
  const timeline = timelines.find((t) => t.phaseId === phaseId);
  const assigned = intent.assignments.filter((a) => a.phaseId === phaseId);
  const ink = projectInk(projectIndex.get(project?.id ?? "") ?? 0);
  const start = sprints.find((s) => s.id === timeline?.startSprintId);
  const end = sprints.find((s) => s.id === timeline?.endSprintId);
  const duration =
    start && end
      ? sprints.filter((s) => s.startDate >= start.startDate && s.startDate <= end.startDate)
          .length
      : 0;

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-stone-300 bg-[#f7f3ea]">
      <Header
        title={phase && project ? phaseLabel(project, phase) : (phase?.name ?? "Phase")}
        kicker={project ? `${projectCode(project)} · ${project.name}` : undefined}
        swatch={ink.fill}
        onClose={onClose}
      />
      <div className="space-y-4 overflow-y-auto p-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {project && <CopySlug value={projectCode(project)} />}
          {project && <CopySlug value={project.id} />}
          {phase && <CopySlug value={phase.id} />}
        </div>
        {phase?.kind && (
          <Badge variant="secondary" className="capitalize">
            {phase.kind}
          </Badge>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-stone-500">Effort</dt>
          <dd>{phase ? formatEffortDays(phase.effortDays) : "—"}</dd>
          <dt className="text-stone-500">Remaining</dt>
          <dd>{timeline ? formatEffortDays(timeline.remainingDays) : "—"}</dd>
          <dt className="text-stone-500">Window</dt>
          <dd>
            {start && end
              ? `${start.name} – ${end.name} (${duration} sprint${duration === 1 ? "" : "s"})`
              : "Not placed"}
          </dd>
        </dl>
        <Separator />
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
            Assignments
          </p>
          <ul className="space-y-2">
            {assigned.length === 0 && (
              <li className="text-stone-500">None — this phase is unscheduled.</li>
            )}
            {assigned.map((row) => {
              const person = intent.engineers.find((e) => e.id === row.engineerId);
              return (
                <li key={row.engineerId}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span>{person?.name ?? row.engineerId}</span>
                    <CopySlug value={row.engineerId} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-stone-200">
                    <div
                      className="h-full bg-stone-800"
                      style={{ width: `${Math.min(100, row.fraction * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    {Math.round(row.fraction * 100)}% of capacity while eligible
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <Separator />
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
            Why this start
          </p>
          <p className="text-stone-700">{timeline?.whyStart}</p>
        </div>
      </div>
    </aside>
  );
}

function Header({
  title,
  kicker,
  swatch,
  onClose,
}: {
  title: string;
  kicker?: string;
  swatch?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-stone-300 px-4 py-3">
      <div className="min-w-0">
        {kicker && (
          <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-stone-500 uppercase">
            {swatch && (
              <span className="size-2 rounded-sm" style={{ background: swatch }} />
            )}
            {kicker}
          </p>
        )}
        <h2 className="font-heading text-xl leading-tight">{title}</h2>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close inspector">
        <XIcon />
      </Button>
    </div>
  );
}
