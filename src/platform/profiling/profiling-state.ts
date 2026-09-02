import { NoopProfiler } from "./noop-profiler.js";
import { Profiler } from "./profiler.js";

type ActiveProfiler = Profiler | NoopProfiler;

let activeProfiler: ActiveProfiler = new NoopProfiler();
let profilingEnabled = false;

export function setActiveProfiler(profiler: ActiveProfiler, enabled: boolean): void {
  activeProfiler = profiler;
  profilingEnabled = enabled;
}

export function getActiveProfiler(): ActiveProfiler {
  return activeProfiler;
}

export function isProfilingEnabled(): boolean {
  return profilingEnabled;
}

export function resetProfilingState(): void {
  activeProfiler = new NoopProfiler();
  profilingEnabled = false;
}
