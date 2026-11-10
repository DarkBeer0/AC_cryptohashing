import { config } from "../src/config.js";
import { pool } from "../src/db.js";

// Наполняет таблицу records тестовыми данными.
// Строки генерирует сам PostgreSQL (generate_series) — это на порядки быстрее,
// чем слать их из Node. Вставка идёт пачками, чтобы был виден прогресс
// и не получалась одна гигантская транзакция.

const BATCH_SIZE = 500_000;
const fmt = (n: number) => n.toLocaleString("ru-RU");

const { rows } = await pool.query<{ max: number | null }>("SELECT max(id) AS max FROM records");
const existing = rows[0]!.max ?? 0;
const target = config.seedRows;

if (existing >= target) {
  console.log(`В records уже ${fmt(existing)} строк, цель ${fmt(target)} — нечего делать.`);
} else {
  const startedAt = Date.now();
  for (let from = existing + 1; from <= target; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, target);
    await pool.query(
      `INSERT INTO records (id, first_name, last_name, email, payload, amount, created_at)
       SELECT g,
              'first_' || g,
              'last_' || g,
              'user' || g || '@example.com',
              md5(g::text) || md5((g * 7)::text),
              round((random() * 10000)::numeric, 2),
              now() - random() * interval '365 days'
       FROM generate_series($1::bigint, $2::bigint) AS g`,
      [from, to],
    );
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`${fmt(to)} / ${fmt(target)} строк (${seconds} c)`);
  }
  // id вставляли явно — подтягиваем sequence и обновляем статистику.
  await pool.query("SELECT setval(pg_get_serial_sequence('records', 'id'), (SELECT max(id) FROM records))");
  await pool.query("ANALYZE records");
  console.log("Готово.");
}

await pool.end();
