import { romanizeForeignLocally } from "./foreign-romanization-engine";

self.onmessage = async event => {
  const { id, lines, japanese } = event.data;
  try { self.postMessage({ id, lines: await romanizeForeignLocally(lines, japanese) }); }
  catch (error) { self.postMessage({ id, error: String(error) }); }
};
