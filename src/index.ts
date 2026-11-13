import { config } from "./config.js";
import { pool } from "./db.js";
import { Worker } from "node:worker_threads";
import { type RecordRow } from "./hash.js";
import os from "node:os";

const WORKER_COUNT = os.availableParallelism() - 1;
const workers = Array.from(
  { length: WORKER_COUNT },
  () =>
    new Worker(new URL("./worker-boot.mjs", import.meta.url), {
      workerData: { file: new URL("./worker.ts", import.meta.url).href },
    }),
);

function runTask(
  worker: Worker,
  rows: RecordRow[],
): Promise<[number, string][]> {
  return new Promise((resolve, reject) => {
    const onMessage = (result: [number, string][]) => {
      worker.off("error", onError);
      resolve(result);
    };
    const onError = (e: Error) => {
      worker.off("message", onMessage);
      reject(e);
    };
    worker.once("message", onMessage);
    worker.once("error", onError);
    worker.postMessage(rows);
  });
}

const BATCH_SIZE = 1000;

async function main(): Promise<void> {
  console.log(`HASH_ROUNDS = ${config.hashRounds}`);
  const { rows } = await pool.query<{ max: number | null }>(
    "SELECT max(record_id) AS max FROM record_hashes",
  );
  let lastId = rows[0]!.max ?? 0;
  const start = performance.now();
  let processed = 0;
  while (true) {
    const dbRequest = await pool.query<RecordRow>(
      "SELECT * FROM records WHERE id > $1 ORDER BY id LIMIT $2",
      [lastId, WORKER_COUNT * BATCH_SIZE],
    );
    if (dbRequest.rows.length === 0) {
      break;
    }
    lastId = dbRequest.rows[dbRequest.rows.length - 1].id;
    const chunks: RecordRow[][] = [];
    for (let i = 0; i < dbRequest.rows.length; i += BATCH_SIZE) {
      chunks.push(dbRequest.rows.slice(i, i + BATCH_SIZE));
    }

    const pairs = await Promise.all(
      chunks.map((chunk, i) => runTask(workers[i]!, chunk)),
    );
    const flat = pairs.flat();
    const secondsHash = (performance.now() - start) / 1000;
    await pool.query(
      "INSERT INTO record_hashes (record_id, hash) SELECT * FROM unnest($1::bigint[], $2::text[]) ON CONFLICT (record_id) DO NOTHING",
      [flat.map((p) => p[0]), flat.map((p) => p[1])],
    );
    processed += flat.length;
    const seconds = (performance.now() - start) / 1000;
    console.log(
      `Прошло ${seconds.toFixed(2)} с, обработано ${processed}, скорость ${(processed / seconds).toFixed(0)} записей/с. Время на хеширование ${secondsHash.toFixed(2)} с`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    async () => {
      await Promise.all(workers.map((worker) => worker.terminate()));
    };
    pool.end();
  });
