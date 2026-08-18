"use client";

import { Button } from "@/components/ui/button";
import { PROJECT_COLORS, projectColor } from "@/lib/project-colors";
import type { Project } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { usePlanWatch } from "../../_components/use-plan-watch";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createProject, editProject, type AddProjectState } from "../actions";

export function ProjectsRoster({ projects }: { projects: Project[] }) {
  usePlanWatch();

  return (
    <div className="h-full overflow-auto">
      <header className="border-b border-stone-300 px-8 py-6">
        <p className="font-mono text-[10px] tracking-[0.2em] text-stone-500 uppercase">Portfolio</p>
        <h1 className="font-heading mt-1 text-4xl tracking-tight">Projects</h1>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          Manage project names, card codes, and scheduling priority. A lower priority number is scheduled first.
        </p>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-8">
        <section>
          <div className="mb-3 flex items-baseline justify-between border-b border-stone-300 pb-1">
            <h2 className="font-heading text-2xl tracking-tight">Current projects</h2>
            <p className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">{projects.length}</p>
          </div>
          <div className="divide-y divide-stone-300 border-y border-stone-300">
            {projects.map((project) => <ProjectRow key={`${project.id}:${project.name}:${project.code}:${project.color}:${project.priority}`} project={project} />)}
            {!projects.length && <p className="px-3 py-5 text-sm text-stone-600">No projects yet.</p>}
          </div>
        </section>

        <AddProjectForm />
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code);
  const [color, setColor] = useState(project.color ?? "teal");
  const [priority, setPriority] = useState(String(project.priority));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await editProject(project.id, name, code, color, Number(priority));
      setError(result.error);
    });
  }

  return (
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] sm:items-end">
      <label className="block">
        <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Name</span>
        <input aria-label="Project name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Card code</span>
        <input aria-label="Project code" value={code} disabled={pending} onChange={(event) => setCode(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Priority</span>
        <input aria-label="Project priority" type="number" min={1} step={1} value={priority} disabled={pending} onChange={(event) => setPriority(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
      </label>
      <Button type="button" onClick={save} disabled={pending} className="h-8">{pending ? "Saving…" : "Save"}</Button>
      <div className="sm:col-span-4">
        <p className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Colour</p>
        <ColourPicker value={color} onChange={setColor} disabled={pending} />
      </div>
      <p className="font-mono text-[10px] text-stone-500 sm:col-span-4">{project.id}</p>
      {error && <p className="text-sm text-[#7c2d12] sm:col-span-4">{error}</p>}
    </div>
  );
}

function AddProjectForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState("teal");
  const [state, action, pending] = useActionState(createProject, { error: null, added: false } satisfies AddProjectState);

  useEffect(() => {
    if (state.added) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <section className="border border-dashed border-stone-400 bg-[#faf7ef] p-5">
      <h2 className="font-heading text-2xl tracking-tight">Add a project</h2>
      <p className="mt-1 text-sm text-stone-600">Add phases and assignments afterwards to schedule work.</p>
      <form ref={formRef} action={action} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto]">
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Name</span>
          <input name="name" required placeholder="Payments" className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Card code</span>
          <input name="code" required placeholder="Pay" className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Priority</span>
          <input name="priority" type="number" min={1} step={1} required defaultValue={1} className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800" />
        </label>
        <div className="sm:col-span-4">
          <p className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Colour</p>
          <input type="hidden" name="color" value={color} />
          <ColourPicker value={color} onChange={setColor} disabled={pending} />
        </div>
        <div className="flex items-end"><Button type="submit" disabled={pending} className={cn("h-8")}>{pending ? "Adding…" : "Add"}</Button></div>
      </form>
      {state.error && <p className="mt-3 text-sm text-[#7c2d12]">{state.error}</p>}
    </section>
  );
}

function ColourPicker({ value, onChange, disabled }: { value: string; onChange: (color: string) => void; disabled: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Project colour">
      {PROJECT_COLORS.map((color) => {
        const selected = color.id === value;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            title={color.label}
            disabled={disabled}
            onClick={() => onChange(color.id)}
            className={cn("size-9 rounded-md border-2 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50", selected ? "scale-105 border-stone-900 ring-2 ring-stone-300" : "border-white/70")}
            style={{ background: projectColor(color.id).solid }}
          />
        );
      })}
    </div>
  );
}
