import { parentPort } from "node:worker_threads";
import { hashRecord, type RecordRow } from "./hash.js";

parentPort!.on("message", (rows: RecordRow[]) => {
  const pairs: [number, string][] = rows.map((row) => [
    row.id,
    hashRecord(row),
  ]);
  parentPort!.postMessage(pairs);
});
