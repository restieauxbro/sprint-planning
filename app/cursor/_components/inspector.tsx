"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  Assignment,
  Engineer,
  Phase,
  PhaseDependency,
  Project,
  Sprint,
} from "@/lib/schema";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePhaseEffortAction } from "../actions";
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
    phaseDependencies: PhaseDependency[];
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
  const dependentPhaseIds = intent.phaseDependencies.flatMap((dependency) =>
    dependency.dependencyType === "finish_to_start" &&
    dependency.predecessorPhaseId === phaseId
      ? [dependency.successorPhaseId]
      : [],
  );
  const dependentPhases = intent.phases
    .filter((candidate) => dependentPhaseIds.includes(candidate.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const startsTogetherIds = timeline?.startsTogetherWithIds ?? [];
  const startsTogetherPhases = intent.phases.filter((candidate) =>
    startsTogetherIds.includes(candidate.id),
  );
  const ink = projectInk(project?.color ?? projectIndex.get(project?.id ?? "") ?? 0);
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
          <dd>
            {phase ? (
              <EffortEditor key={`${phase.id}:${phase.effortDays}`} phase={phase} />
            ) : (
              "—"
            )}
          </dd>
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
        {startsTogetherPhases.length > 0 && (
          <>
            <div>
              <p className="mb-2 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
                Starts together with
              </p>
              <ul className="space-y-1.5">
                {startsTogetherPhases.map((groupedPhase) => (
                  <li key={groupedPhase.id} className="font-medium">
                    {project ? phaseLabel(project, groupedPhase) : groupedPhase.name}
                  </li>
                ))}
              </ul>
            </div>
            <Separator />
          </>
        )}
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
            Dependent phases
          </p>
          {dependentPhases.length > 0 && project ? (
            <div className="space-y-2">
              {dependentPhases.map((dependentPhase) => (
                <DependentPhaseCard
                  key={dependentPhase.id}
                  phase={dependentPhase}
                  project={project}
                  assignments={intent.assignments}
                  engineers={intent.engineers}
                />
              ))}
            </div>
          ) : (
            <p className="text-stone-500">No phases depend on this one finishing.</p>
          )}
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

function DependentPhaseCard({
  phase,
  project,
  assignments,
  engineers,
}: {
  phase: Phase;
  project: Project;
  assignments: Assignment[];
  engineers: Engineer[];
}) {
  const assigned = assignments.filter((assignment) => assignment.phaseId === phase.id);
  return (
    <div className="rounded-md border border-stone-300 bg-[#faf7ef] p-3">
      <p className="font-medium">{phaseLabel(project, phase)}</p>
      <p className="mt-0.5 text-[11px] text-stone-500">
        {formatEffortDays(phase.effortDays)}
      </p>
      <ul className="mt-2 space-y-1 border-t border-stone-200 pt-2">
        {assigned.length === 0 && <li className="text-xs text-stone-500">No one assigned.</li>}
        {assigned.map((assignment) => {
          const person = engineers.find((engineer) => engineer.id === assignment.engineerId);
          return (
            <li
              key={assignment.engineerId}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>{person?.name ?? assignment.engineerId}</span>
              <span className="font-mono text-[10px] text-stone-500">
                {Math.round(assignment.fraction * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EffortEditor({ phase }: { phase: Phase }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(phase.effortDays));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setValue(String(phase.effortDays));
    setError(null);
    setEditing(false);
  }

  function save() {
    const effortDays = Number(value);
    if (!Number.isFinite(effortDays) || effortDays <= 0) {
      setError("Enter a value greater than 0.");
      return;
    }
    startTransition(async () => {
      const result = await updatePhaseEffortAction(phase.id, effortDays);
      setError(result.error);
      if (!result.error) setEditing(false);
    });
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span>{formatEffortDays(phase.effortDays)}</span>
        <button
          type="button"
          className="font-mono text-[10px] text-stone-500 hover:text-stone-900 hover:underline"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </span>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <input
        aria-label="Effort in days"
        autoFocus
        type="number"
        min="0"
        step="1"
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}
        className="h-7 w-20 rounded-sm border border-stone-400 bg-[#faf7ef] px-1.5 text-sm outline-none focus:border-stone-800"
      />
      <span className="text-xs text-stone-500">days</span>
      <Button type="submit" size="xs" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={cancel}>
        Cancel
      </Button>
      {error && <span className="w-full text-xs text-[#7c2d12]">{error}</span>}
    </form>
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
