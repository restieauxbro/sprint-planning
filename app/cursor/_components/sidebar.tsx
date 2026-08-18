"use client";

import { cn } from "@/lib/utils";
import { CalendarRangeIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sprint-planner.sidebar-collapsed";

const NAV = [
  { href: "/cursor", label: "Planning", icon: CalendarRangeIcon, exact: true },
  { href: "/cursor/team", label: "Team", icon: UsersIcon, exact: false },
] as const;

export function CursorSidebar({ peopleCount }: { peopleCount: number | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "0") setCollapsed(false);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-stone-300/70 bg-[#f4f0e6] text-stone-500",
        collapsed ? "w-11" : "w-44",
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center py-2" : "justify-between px-2.5 py-2")}>
        {!collapsed && (
          <p className="font-heading text-[15px] leading-none tracking-tight text-stone-500">Planner</p>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-7 items-center justify-center rounded-sm text-stone-400 hover:text-stone-600"
        >
          {collapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronLeftIcon className="size-3.5" />}
        </button>
      </div>

      <nav className={cn("flex flex-col", collapsed ? "items-center gap-0.5 px-1" : "gap-0.5 px-1.5")}>
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-sm text-[13px] font-normal transition-colors",
                collapsed ? "size-8 justify-center" : "gap-2 px-2 py-1.5",
                active ? "text-stone-700" : "text-stone-400 hover:text-stone-600",
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={active ? 1.75 : 1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && peopleCount != null && (
        <p className="mt-auto px-3 py-2 font-mono text-[10px] text-stone-400">{peopleCount} people</p>
      )}
    </aside>
  );
}
