import { config } from "./config.js";
import { createHash } from "node:crypto";
export type RecordRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  payload: string;
  amount: string;
  created_at: Date;
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

export function hashRecord(row: RecordRow): string {
  let roundedHash = createHash("sha256").update(concatRecord(row)).digest();
  for (let i = 1; i < config.hashRounds; i++) {
    roundedHash = createHash("sha256").update(roundedHash).digest();
  }
  return roundedHash.toString("hex");
}
