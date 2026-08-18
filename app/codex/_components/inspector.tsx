"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScheduleIntent } from "@/lib/schema";
import type { ScheduleResult } from "../_lib/schedule";
import { formatEffortDays } from "../_lib/schedule";

export type InspectorSelection =
  | { type: "phase"; phaseId: string }
  | { type: "idle"; engineerId: string; sprintId: string }
  | null;

function CopyChip({ value, label = value }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 border border-stone-300 bg-white/60 px-2 py-1 font-mono text-[10px] text-stone-600 hover:border-stone-600"
      title={`Copy ${value}`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label}
    </button>
  );
}

export function Inspector({
  selection,
  onClose,
  intent,
  result,
  projectColors,
}: {
  selection: Exclude<InspectorSelection, null>;
  onClose: () => void;
  intent: ScheduleIntent;
  result: ScheduleResult;
  projectColors: Map<string, { solid: string; pale: string; border: string }>;
}) {
  if (selection.type === "idle") {
    const engineer = intent.engineers.find((item) => item.id === selection.engineerId)!;
    const sprint = intent.sprints.find((item) => item.id === selection.sprintId)!;
    const load = result.loads.find(
      (item) => item.engineerId === engineer.id && item.sprintId === sprint.id,
    );
    return (
      <aside className="sticky top-0 h-dvh w-[360px] shrink-0 overflow-y-auto border-l border-stone-300 bg-[#eee8dc] p-6 shadow-[-8px_0_20px_rgba(71,61,45,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-stone-500 uppercase">Capacity gap</p>
            <h2 className="font-heading mt-2 text-3xl leading-none">Idle time</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector"><X /></Button>
        </div>
        <p className="mt-8 text-lg leading-7">
          {engineer.name} has <strong>{load?.idleDays.toFixed(1).replace(".0", "") ?? 0} idle days</strong> in {sprint.name}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyChip value={engineer.id} />
          <CopyChip value={sprint.id} />
        </div>
        <p className="mt-8 border-l-2 border-amber-600 pl-4 text-sm leading-6 text-stone-600">
          Assign unscheduled work here, or raise the fraction on eligible work that is waiting.
        </p>
      </aside>
    );
  }

  const phase = intent.phases.find((item) => item.id === selection.phaseId)!;
  const project = intent.projects.find((item) => item.id === phase.projectId)!;
  const timeline = result.phaseTimelines.find((item) => item.phaseId === phase.id)!;
  const assignments = intent.assignments.filter((item) => item.phaseId === phase.id);
  const start = intent.sprints.find((item) => item.id === timeline.startSprintId);
  const end = intent.sprints.find((item) => item.id === timeline.endSprintId);
  const startIndex = start ? intent.sprints.findIndex((item) => item.id === start.id) : -1;
  const endIndex = end ? intent.sprints.findIndex((item) => item.id === end.id) : -1;
  const ink = projectColors.get(project.id)!;

  return (
    <aside className="sticky top-0 h-dvh w-[360px] shrink-0 overflow-y-auto border-l border-stone-300 bg-[#eee8dc] p-6 shadow-[-8px_0_20px_rgba(71,61,45,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-stone-500 uppercase">
            <span className="size-2" style={{ background: ink.solid }} />
            {project.code} · {project.name}
          </p>
          <h2 className="font-heading mt-2 text-3xl leading-none">{project.code} {phase.name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close inspector"><X /></Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <CopyChip value={project.code} label={`SKU ${project.code}`} />
        <CopyChip value={project.id} />
        <CopyChip value={phase.id} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px border border-stone-300 bg-stone-300 text-sm">
        <div className="bg-[#f8f4eb] p-3"><span className="block text-xs text-stone-500">Kind</span><Badge className="mt-2" variant="secondary">{phase.kind ?? "phase"}</Badge></div>
        <div className="bg-[#f8f4eb] p-3"><span className="block text-xs text-stone-500">Effort</span><strong className="mt-2 block font-mono text-xs">{formatEffortDays(phase.effortDays)}</strong></div>
        <div className="bg-[#f8f4eb] p-3"><span className="block text-xs text-stone-500">Remaining</span><strong className="mt-2 block font-mono text-xs">{formatEffortDays(timeline.remainingDays)}</strong></div>
        <div className="bg-[#f8f4eb] p-3"><span className="block text-xs text-stone-500">Window</span><strong className="mt-2 block font-mono text-xs">{start && end ? `${start.name} – ${end.name} (${endIndex - startIndex + 1})` : "Not placed"}</strong></div>
      </div>

      <section className="mt-8">
        <h3 className="font-mono text-[10px] tracking-[0.18em] text-stone-500 uppercase">Assignments</h3>
        <div className="mt-3 space-y-4">
          {assignments.length ? assignments.map((assignment) => {
            const engineer = intent.engineers.find((item) => item.id === assignment.engineerId)!;
            return (
              <div key={assignment.engineerId}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span>{engineer.name}</span><span className="font-mono text-xs">{Math.round(assignment.fraction * 100)}%</span>
                </div>
                <div className="h-2 bg-stone-300"><div className="h-full" style={{ width: `${assignment.fraction * 100}%`, background: ink.solid }} /></div>
                <div className="mt-2"><CopyChip value={engineer.id} /></div>
              </div>
            );
          }) : <p className="text-sm text-amber-800">Nobody assigned.</p>}
        </div>
      </section>

      <section className="mt-8 border-t border-stone-300 pt-6">
        <h3 className="font-mono text-[10px] tracking-[0.18em] text-stone-500 uppercase">Why this start</h3>
        <p className="mt-3 text-sm leading-6 text-stone-700">{timeline.whyStart}</p>
      </section>
    </aside>
  );
}
