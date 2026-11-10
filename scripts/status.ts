import { pool } from "../src/db.js";

// Показывает прогресс: сколько записей всего и сколько хэшей уже посчитано.
// Внимание: точный count(*) на десятках миллионов строк сам занимает секунды.

const { rows } = await pool.query<{ records: number; hashes: number }>(`
  SELECT
    (SELECT count(*) FROM records)       AS records,
    (SELECT count(*) FROM record_hashes) AS hashes
`);
const { records, hashes } = rows[0]!;
const percent = records === 0 ? 0 : (hashes / records) * 100;

console.log(`records:       ${records.toLocaleString("ru-RU")}`);
console.log(`record_hashes: ${hashes.toLocaleString("ru-RU")} (${percent.toFixed(2)}%)`);

await pool.end();
