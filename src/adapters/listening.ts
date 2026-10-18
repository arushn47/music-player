import { invoke } from "@tauri-apps/api/core";
import { desktop } from "./native";
import type { ListeningRecord } from "../domain/listening";

export interface ListeningSnapshot { generation: number; records: ListeningRecord[] }
export const listeningStore = {
  load: (): Promise<ListeningSnapshot> => desktop ? invoke("get_listening_history") : Promise.resolve({ generation: 0, records: [] }),
  checkpoint: (generation: number, record: ListeningRecord): Promise<boolean> => desktop ? invoke("checkpoint_listening", { generation, record }) : Promise.resolve(true),
  clear: (): Promise<number> => desktop ? invoke("clear_listening_history") : Promise.resolve(0),
};
