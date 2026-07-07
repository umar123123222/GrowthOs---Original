// Tiny global progress-bar store using ref counting.
// Any in-flight async work can call start() / done() to drive the bar.

type Listener = (active: number) => void;

let active = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(active));
}

export const progressBar = {
  start() {
    active += 1;
    emit();
  },
  done() {
    active = Math.max(0, active - 1);
    emit();
  },
  reset() {
    active = 0;
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(active);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return active;
  },
};

/** Wrap any promise so the progress bar shows during it. */
export async function withProgress<T>(p: Promise<T> | (() => Promise<T>)): Promise<T> {
  progressBar.start();
  try {
    return await (typeof p === 'function' ? p() : p);
  } finally {
    progressBar.done();
  }
}
