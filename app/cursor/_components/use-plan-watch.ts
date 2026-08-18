"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type LiveState = "connecting" | "live" | "down";

export function usePlanWatch() {
  const router = useRouter();
  const [live, setLive] = useState<LiveState>("connecting");
  const [flash, setFlash] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/watch");
    es.onopen = () => setLive("live");
    es.onmessage = () => {
      setLive("live");
      setFlash(true);
      setUpdatedAt(new Date());
      router.refresh();
      window.setTimeout(() => setFlash(false), 2400);
    };
    es.onerror = () => setLive("down");
    return () => es.close();
  }, [router]);

  return { live, flash, updatedAt, refresh: () => router.refresh() };
}
