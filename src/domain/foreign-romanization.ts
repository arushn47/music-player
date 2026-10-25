const foreign = /[\u0370-\u052f\u0590-\u08ff\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (lines: string[]) => void; reject: (error: Error) => void }>();


export function romanizeForeign(lines: string[], japanese = false): Promise<string[]> {
  if (!lines.some(line => foreign.test(line))) return Promise.resolve(lines);
  if (typeof Worker === "undefined") return import("./foreign-romanization-engine").then(engine => engine.romanizeForeignLocally(lines, japanese));
  if (!worker) {
    worker = new Worker(new URL("./romanization.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = event => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data.lines);
    };
    worker.onerror = () => {
      for (const request of pending.values()) request.reject(new Error("The offline romanization worker could not load."));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker!.postMessage({ id, lines, japanese }); });
}
