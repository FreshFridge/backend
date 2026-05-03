import sql from "mssql";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER ?? "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true"
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  requestTimeout: 30000,
  connectionTimeout: 30000
};

const retries = Number(process.env.DB_CONNECT_RETRIES ?? 10);
const retryDelayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 3000);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(): Promise<sql.ConnectionPool> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const pool = await new sql.ConnectionPool(config).connect();
      logger.info("Connected to MSSQL", { database: config.database });
      return pool;
    } catch (err) {
      lastError = err;
      logger.error("MSSQL connection failed", { attempt, retries });

      if (attempt < retries) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError;
}

export const poolPromise = connectWithRetry();

export { sql };
