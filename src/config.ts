function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
  }
  return value;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  seedRows: Number(process.env.SEED_ROWS ?? 1_000_000),
  hashRounds: Number(process.env.HASH_ROUNDS ?? 1000),
};
