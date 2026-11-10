-- Исходные данные: десятки миллионов строк.
CREATE TABLE IF NOT EXISTS records (
    id          BIGSERIAL PRIMARY KEY,
    first_name  TEXT           NOT NULL,
    last_name   TEXT           NOT NULL,
    email       TEXT           NOT NULL,
    payload     TEXT           NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- Результат: один хэш на одну запись.
-- PRIMARY KEY по record_id не даёт записать хэш одной записи дважды.
CREATE TABLE IF NOT EXISTS record_hashes (
    record_id   BIGINT PRIMARY KEY REFERENCES records (id),
    hash        CHAR(64)    NOT NULL, -- SHA-256 в hex
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
