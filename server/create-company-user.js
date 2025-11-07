import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const args = process.argv.slice(2);

function parseArgs() {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key?.startsWith("--")) {
      throw new Error(`Argumento inválido: ${key}`);
    }
    if (!value) {
      throw new Error(`Valor ausente para ${key}`);
    }
    result[key.slice(2)] = value;
  }
  return result;
}

const COMPANY_CODE_PREFIX = process.env.COMPANY_CODE_PREFIX ?? "ATV";
const COMPANY_CODE_RANDOM_LENGTH = Number(process.env.COMPANY_CODE_LENGTH ?? 6);
const PASSWORD_SALT_ROUNDS = Number(process.env.AUTH_SALT_ROUNDS ?? 10);

function sanitizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLogin(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function generateCompanyCodeCandidate() {
  const suffix = randomUUID().replace(/-/g, "").toUpperCase().slice(0, COMPANY_CODE_RANDOM_LENGTH);
  return `${COMPANY_CODE_PREFIX}-${suffix}`;
}

async function generateUniqueCompanyCode(client = prisma) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateCompanyCodeCandidate();
    const exists = await client.company.count({ where: { code: candidate } });
    if (exists === 0) {
      return candidate;
    }
  }
  throw new Error("Não foi possível gerar um código de empresa único");
}

function printUsage() {
  console.log(`\nUso:\n  node server/create-company-user.js \
    --cnpj 61696529000186 \
    --nome "Empresa Teste" \
    --razao "Empresa Teste LTDA" \
    --email "cliente@teste.com" \
    --login "cliente.teste" \
    --senha "Senha123!" \
    [--role USER|COMPANY_ADMIN]\n`);
  console.log("Observação: --role padrão é USER.\n");
}

(async () => {
  try {
    if (args.length === 0 || args.includes("--help")) {
      printUsage();
      process.exit(0);
    }

    const parsed = parseArgs();

    const cnpj = sanitizeCnpj(parsed.cnpj);
    const nomeFantasia = normalizeText(parsed.nome);
    const razaoSocial = normalizeText(parsed.razao);
    const email = normalizeEmail(parsed.email);
    const login = normalizeLogin(parsed.login);
    const senha = parsed.senha;
    const role = parsed.role === "COMPANY_ADMIN" ? UserRole.COMPANY_ADMIN : UserRole.USER;

    if (cnpj.length !== 14) {
      throw new Error("CNPJ inválido. Informe 14 dígitos.");
    }
    if (!nomeFantasia || !razaoSocial) {
      throw new Error("Informe nome fantasia e razão social válidos.");
    }
    if (!email) {
      throw new Error("Informe um email válido.");
    }
    if (!login) {
      throw new Error("Informe um login válido.");
    }
    if (typeof senha !== "string" || senha.length < 8) {
      throw new Error("Senha deve ter pelo menos 8 caracteres.");
    }

    const passwordHash = await bcrypt.hash(senha, PASSWORD_SALT_ROUNDS);

    const result = await prisma.$transaction(async (tx) => {
      const companyCode = await generateUniqueCompanyCode(tx);

      const company = await tx.company.create({
        data: {
          code: companyCode,
          cnpj,
          nomeFantasia,
          razaoSocial,
        },
      });

      const user = await tx.user.create({
        data: {
          name: nomeFantasia,
          login,
          email,
          passwordHash,
          role,
          companyId: company.id,
        },
      });

      return { company, user };
    });

    console.log("\n✅ Empresa criada com sucesso!");
    console.log(`Código da empresa: ${result.company.code}`);
    console.log(`Empresa: ${result.company.nomeFantasia}`);
    console.log(`Usuário (${result.user.role}): ${result.user.login}`);
    console.log(`E-mail: ${result.user.email}`);
  } catch (error) {
    console.error("\n❌ Erro ao criar empresa:", error instanceof Error ? error.message : error);
    printUsage();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
