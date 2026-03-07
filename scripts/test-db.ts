import "dotenv/config";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query("SELECT NOW()");
  console.log("Conexão OK:", result.rows[0]);
  await client.end();
}

main().catch((error) => {
  console.error("Falha ao conectar:", error);
  process.exit(1);
});