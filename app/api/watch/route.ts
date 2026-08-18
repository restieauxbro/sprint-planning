import fs from "node:fs";
import path from "node:path";
import { getDbPath, reopenDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Subscriber = {
  write: (chunk: string) => void;
};

type WatchState = {
  watcher: fs.FSWatcher | null;
  subscribers: Set<Subscriber>;
  timer: ReturnType<typeof setTimeout> | null;
  watchingDir: string;
};

const globalForWatch = globalThis as unknown as { __plannerWatch?: WatchState };

function getState(): WatchState {
  if (!globalForWatch.__plannerWatch) {
    globalForWatch.__plannerWatch = {
      watcher: null,
      subscribers: new Set(),
      timer: null,
      watchingDir: "",
    };
  }
  return globalForWatch.__plannerWatch;
}

function isPlanFile(filename: string | null) {
  if (!filename) return false;
  if (filename.endsWith("-shm")) return false;
  return (
    filename === "planner.sqlite" ||
    filename === "planner.sqlite-wal" ||
    filename.endsWith(".sqlite") ||
    filename.endsWith(".sqlite-wal")
  );
}

function ensureWatcher() {
  const state = getState();
  const dir = path.dirname(getDbPath());
  if (state.watcher && state.watchingDir === dir) return;

  state.watcher?.close();
  state.watchingDir = dir;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  state.watcher = fs.watch(dir, { persistent: true }, (_event, filename) => {
    if (!isPlanFile(typeof filename === "string" ? filename : null)) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      reopenDb();
      for (const sub of state.subscribers) {
        try {
          sub.write("data: reload\n\n");
        } catch {
          state.subscribers.delete(sub);
        }
      }
    }, 200);
  });
}

export async function GET(request: Request) {
  ensureWatcher();
  const state = getState();
  const encoder = new TextEncoder();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let subscriber: Subscriber | undefined;

  const stream = new ReadableStream({
    start(controller) {
      subscriber = {
        write(chunk) {
          controller.enqueue(encoder.encode(chunk));
        },
      };
      state.subscribers.add(subscriber);
      controller.enqueue(encoder.encode(": connected\n\n"));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 20_000);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (heartbeat) clearInterval(heartbeat);
    if (subscriber) state.subscribers.delete(subscriber);
  }

  request.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
