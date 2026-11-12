import { config } from "./config.js";
import { pool } from "./db.js";
import { createHash } from "node:crypto";

type RecordRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  payload: string;
  amount: string; // NUMERIC драйвер pg отдаёт строкой
  created_at: Date; // TIMESTAMPTZ приходит как Date
};

function concatRecord(row: RecordRow): string {
  const parts = [
    row.id,
    row.first_name,
    row.last_name,
    row.email,
    row.payload,
    row.amount,
    row.created_at.toISOString(),
  ];
  return parts.join("|");
}

const BATCH_SIZE = 1000;

function hashRecord(row: RecordRow): string {
  let roundedHash = createHash("sha256").update(concatRecord(row)).digest();
  for (let i = 1; i < config.hashRounds; i++) {
    roundedHash = createHash("sha256").update(roundedHash).digest();
  }
  return roundedHash.toString("hex");
}

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
      [lastId, BATCH_SIZE],
    );
    if (dbRequest.rows.length === 0) {
      break;
    }
    lastId = dbRequest.rows[dbRequest.rows.length - 1].id;
    const map = new Map<number, string>();
    for (const row of dbRequest.rows) {
      map.set(row.id, hashRecord(row));
    }
    const secondsHash = (performance.now() - start) / 1000;
    await pool.query(
      "INSERT INTO record_hashes (record_id, hash) SELECT * FROM unnest($1::bigint[], $2::text[]) ON CONFLICT (record_id) DO NOTHING",
      [[...map.keys()], [...map.values()]],
    );
    processed += map.size;
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
  .finally(() => pool.end());
