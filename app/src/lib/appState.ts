import { useEffect, useState } from "react";
import type { Bootstrap, TrailClient } from "./api";

/* One store for the bootstrap payload; SSE change events trigger a
   debounced refetch (data volumes are N=1-sized, a refetch is cheap and
   never drifts from the sidecar). */

const EMPTY: Bootstrap = { tasks: [], objectives: [], sessions: [], projects: [], recons: [], settings: { connectedApps: [], excludedStoreDirs: [] } };

export class AppState {
  private data: Bootstrap = EMPTY;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly client: TrailClient) {}

  get(): Bootstrap {
    return this.data;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async refresh(): Promise<void> {
    this.data = await this.client.bootstrap();
    for (const cb of this.listeners) cb();
  }

  start(): () => void {
    void this.refresh();
    const stop = this.client.subscribe(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.refresh(), 150);
    });
    return () => {
      clearTimeout(this.timer);
      stop();
    };
  }
}

export function useBootstrap(state: AppState): Bootstrap {
  const [snapshot, setSnapshot] = useState(state.get());
  useEffect(() => {
    const unsub = state.subscribe(() => setSnapshot({ ...state.get() }));
    setSnapshot({ ...state.get() });
    return unsub;
  }, [state]);
  return snapshot;
}
