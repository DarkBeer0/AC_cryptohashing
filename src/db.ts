import pg from "pg";
import { config } from "./config.js";

// BIGINT (int8) и COUNT(*) pg по умолчанию отдаёт строкой — здесь значения
// заведомо помещаются в Number, поэтому парсим их в число.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
