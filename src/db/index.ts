import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Initialized once per process; postgres() connects lazily, so importing this
// module never opens a socket until the first query.
export const connection = postgres(process.env.DATABASE_URL ?? "", {
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(connection, { schema });

export * as tables from "./schema";
