"use client";

import { addTeammate, renameTeammate, type AddTeammateState } from "../actions";
import { Button } from "@/components/ui/button";
import type { Engineer } from "@/lib/schema";
import { initials } from "../../_components/colors";
import { usePlanWatch } from "../../_components/use-plan-watch";
import { cn } from "@/lib/utils";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

const TITLE_PRESETS = ["Engineer", "BA"] as const;

export function TeamRoster({ people }: { people: Engineer[] }) {
  usePlanWatch();
  const grouped = groupByTitle(people);

  return (
    <div className="h-full overflow-auto">
      <header className="border-b border-stone-300 px-8 py-6">
        <p className="font-mono text-[10px] tracking-[0.2em] text-stone-500 uppercase">Roster</p>
        <h1 className="font-heading mt-1 text-4xl tracking-tight">Team</h1>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          Titles live here. The planning board still shows names and FTE only.
        </p>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-8 py-8">
        {grouped.map(([title, members]) => (
          <section key={title}>
            <div className="mb-3 flex items-baseline justify-between border-b border-stone-300 pb-1">
              <h2 className="font-heading text-2xl tracking-tight">{title}</h2>
              <p className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">
                {members.length}
              </p>
            </div>
            <ul className="divide-y divide-stone-300">
              {members.map((person) => (
                <li key={person.id} className="flex items-center gap-4 py-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-stone-900 font-mono text-sm text-[#f4f0e6]">
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <PersonName person={person} />
                    <p className="font-mono text-[11px] text-stone-500">{person.id}</p>
                  </div>
                  <p className="font-mono text-[11px] text-stone-600">{person.fte.toFixed(1)} FTE</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <AddTeammateForm />
      </div>
    </div>
  );
}

function groupByTitle(people: Engineer[]) {
  const order: string[] = [];
  const map = new Map<string, Engineer[]>();
  for (const person of people) {
    const title = person.title.trim() || "Untitled";
    if (!map.has(title)) {
      order.push(title);
      map.set(title, []);
    }
    map.get(title)!.push(person);
  }
  const preferred = ["Engineer", "BA"];
  order.sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
  return order.map((title) => [title, map.get(title)!] as const);
}

function PersonName({ person }: { person: Engineer }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(person.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const skipSave = useRef(false);

  useEffect(() => {
    setValue(person.name);
  }, [person.name]);

  function finish(nextName: string) {
    const next = nextName.trim();
    if (!next || next === person.name) {
      setValue(person.name);
      setEditing(false);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await renameTeammate(person.id, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setError(null);
    });
  }

  if (editing) {
    return (
      <div>
        <input
          aria-label="Name"
          autoFocus
          disabled={pending}
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (skipSave.current) {
              skipSave.current = false;
              return;
            }
            finish(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              skipSave.current = true;
              setValue(person.name);
              setEditing(false);
              setError(null);
            }
          }}
          className="h-7 w-full max-w-xs rounded-sm border border-stone-400 bg-[#faf7ef] px-1.5 text-base font-medium text-stone-900 outline-none focus:border-stone-800"
        />
        {error && <p className="mt-1 text-xs text-[#7c2d12]">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="max-w-full truncate text-left text-base font-medium text-stone-900 hover:underline hover:decoration-stone-400 hover:underline-offset-4"
    >
      {person.name}
    </button>
  );
}

function AddTeammateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addTeammate, {
    error: null,
    added: false,
  } satisfies AddTeammateState);

  useEffect(() => {
    if (state.added) formRef.current?.reset();
  }, [state]);

  return (
    <section className="border border-dashed border-stone-400 bg-[#faf7ef] p-5">
      <h2 className="font-heading text-2xl tracking-tight">Add a teammate</h2>
      <p className="mt-1 text-sm text-stone-600">They appear on the planning board on the next refresh.</p>
      <form ref={formRef} action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_5.5rem_auto]">
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Name</span>
          <input
            name="name"
            required
            placeholder="Jane Doe"
            className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">Title</span>
          <input
            name="title"
            required
            defaultValue="Engineer"
            list="team-titles"
            className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800"
          />
          <datalist id="team-titles">
            {TITLE_PRESETS.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">FTE</span>
          <input
            name="fte"
            type="number"
            min={0.1}
            max={1}
            step={0.1}
            defaultValue={1}
            className="mt-1 h-8 w-full rounded-md border border-stone-300 bg-[#f4f0e6] px-2 text-sm outline-none focus:border-stone-800"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className={cn("h-8")}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>
      {state.error && <p className="mt-3 text-sm text-[#7c2d12]">{state.error}</p>}
    </section>
  );
}
