import "dotenv/config";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { PrismaClient, UserRole, Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import archiver from "archiver";
import multer from "multer";
import { generateCompanyInsights, isAiConfigured } from "./services/aiSuggestions.js";
import { sendWelcomeEmail, sendPasswordResetEmail, sendQuestionnaireInvitationEmail, isEmailConfigured } from "./services/emailService.js";
import { createCertificatePdf } from "./services/certificateService.js";
import stream from "node:stream";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});
const DEFAULT_QUESTIONNAIRE = "default";
const MAX_SYNC_HISTORY = 50;
const PASSWORD_SALT_ROUNDS = Number(process.env.AUTH_SALT_ROUNDS ?? 10);
const MIN_PASSWORD_LENGTH = Number(process.env.AUTH_MIN_PASSWORD_LENGTH ?? 8);
const DEFAULT_AI_LIMIT = Number(process.env.AI_SUGGESTION_LIMIT ?? 5);

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET não definido; usando fallback inseguro apenas para desenvolvimento.");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "12h";
const AUTH_HEADER_PREFIX = "Bearer ";

function signToken({ id, role, companyId, name, email }) {
  return jwt.sign(
    { 
      sub: id, 
      role, 
      companyId: companyId ?? null,
      name,
      email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function mapCompanySummary(company) {
  if (!company) {
    return null;
  }

  return {
    id: company.id,
    code: company.code,
    nomeFantasia: company.nomeFantasia,
    razaoSocial: company.razaoSocial,
    cnpj: company.cnpj,
  };
}

function mapCompany(company) {
  return {
    id: company.id,
    code: company.code,
    nomeFantasia: company.nomeFantasia,
    razaoSocial: company.razaoSocial,
    cnpj: company.cnpj,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

function mapUserSummary(user) {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function buildUserPayload(user, company) {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    email: user.email,
    role: user.role,
    company: mapCompanySummary(company),
  };
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

async function hashPassword(password) {
  if (!isValidPassword(password)) {
    throw new Error(`Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

async function verifyPassword(candidate, hashed) {
  if (!candidate || !hashed) {
    return false;
  }
  return bcrypt.compare(candidate, hashed);
}

function generateCompanyCode(cnpj) {
  // Remove caracteres não numéricos do CNPJ
  const digits = cnpj.replace(/\D/g, '');
  // Pega os últimos 4 dígitos do CNPJ
  const suffix = digits.slice(-4);
  return `ATV-${suffix}`;
}

function validateCNPJ(cnpj) {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.length === 14;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateQuestionnaireToken() {
  return randomBytes(32).toString('hex');
}

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith(AUTH_HEADER_PREFIX)) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = authorization.slice(AUTH_HEADER_PREFIX.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      companyId: payload.companyId ?? null,
    };
    
    // Criar req.user a partir do payload do token (sem query ao banco)
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? null,
    };
    
    return next();
  } catch (error) {
    console.error("Token validation failed:", error.message);
    return res.status(401).json({ message: "Token inválido" });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "Permissão negada" });
    }
    return next();
  };
}

const requireAdminGlobal = requireRoles(UserRole.ADMIN_GLOBAL);
const requireTrainingManager = requireRoles(UserRole.ADMIN_GLOBAL, UserRole.COMPANY_ADMIN);

async function resolveCompanyContext(req, res) {
  const { role, companyId } = req.auth ?? {};

  if (role !== UserRole.ADMIN_GLOBAL) {
    if (!companyId) {
      res.status(403).json({ message: "Usuário sem empresa vinculada" });
      return null;
    }
    if (!req.company) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        res.status(404).json({ message: "Empresa do usuário não encontrada" });
        return null;
      }
      req.company = company;
    }
    req.companyId = companyId;
    return companyId;
  }

  const explicitId = req.headers["x-company-id"] ?? req.query.companyId;
  const explicitCode = req.headers["x-company-code"] ?? req.query.companyCode;

  if (!explicitId && !explicitCode) {
    res.status(400).json({ message: "Informe companyId ou companyCode para acessar dados de uma empresa" });
    return null;
  }

  const where = explicitId ? { id: String(explicitId) } : { code: String(explicitCode) };
  const company = await prisma.company.findUnique({ where });
  if (!company) {
    res.status(404).json({ message: "Empresa não encontrada" });
    return null;
  }

  req.companyId = company.id;
  req.company = company;
  return company.id;
}

const COMPANY_CODE_PREFIX = process.env.COMPANY_CODE_PREFIX ?? "ATV";
const COMPANY_CODE_RANDOM_LENGTH = Number(process.env.COMPANY_CODE_LENGTH ?? 6);

function sanitizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeLogin(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeEmail(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCompanyCode(value) {
  const trimmed = String(value ?? "").trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function generateCompanyCodeCandidate() {
  const suffix = randomUUID().replace(/-/g, "").toUpperCase().slice(0, COMPANY_CODE_RANDOM_LENGTH);
  return `${COMPANY_CODE_PREFIX}-${suffix}`;
}

/**
 * @param {Prisma.PrismaClient | Prisma.TransactionClient} client
 */
async function generateUniqueCompanyCode(client = prisma) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateCompanyCodeCandidate();
    const exists = await client.company.count({ where: { code: candidate } });
    if (exists === 0) {
      return candidate;
    }
  }
  throw new Error("Não foi possível gerar código de empresa único");
}

function withCompany(handler) {
  return async (req, res) => {
    const companyId = await resolveCompanyContext(req, res);
    if (!companyId) {
      return;
    }
    return handler(req, res, companyId);
  };
}

function normalizeValue(record) {
  if (record.valueNumber !== null && record.valueNumber !== undefined) {
    return record.valueNumber;
  }
  if (record.valueString !== null && record.valueString !== undefined) {
    return record.valueString;
  }
  return undefined;
}

function mapActionPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    problemDescription: plan.problemDescription,
    normativeItem: plan.normativeItem ?? "",
    unitOrSector: plan.unitOrSector ?? "",
    correctiveAction: plan.correctiveAction,
    severity: plan.severity,
    status: plan.status,
    dueDate: plan.dueDate ? plan.dueDate.toISOString() : "",
    responsible: plan.responsible,
    notes: plan.notes ?? undefined,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildCompanyMetrics(companyId) {
  const [responsesCount, actionPlans, syncEntries] = await Promise.all([
    prisma.questionResponse.count({ where: { companyId } }),
    prisma.actionPlan.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.syncEntry.findMany({
      where: { companyId },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const now = new Date();
  const actionPlansTotal = actionPlans.length;
  const byStatus = Object.entries(
    actionPlans.reduce((acc, plan) => {
      acc[plan.status] = (acc[plan.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count }));

  const bySeverity = Object.entries(
    actionPlans.reduce((acc, plan) => {
      acc[plan.severity] = (acc[plan.severity] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count }));

  const overdue = actionPlans.filter(
    (plan) => plan.dueDate && plan.dueDate.getTime() < now.getTime() && plan.status !== "Concluído"
  ).length;

  const recentPlans = actionPlans.slice(0, 5).map((plan) => ({
    id: plan.id,
    title: plan.title,
    status: plan.status,
    severity: plan.severity,
    dueDate: plan.dueDate ? plan.dueDate.toISOString().slice(0, 10) : null,
  }));

  const totalSyncs = syncEntries.length;
  const avgConformity = totalSyncs
    ? Number((syncEntries.reduce((acc, item) => acc + item.conformity, 0) / totalSyncs).toFixed(2))
    : 0;
  const avgCompletion = totalSyncs
    ? Number((syncEntries.reduce((acc, item) => acc + item.completion, 0) / totalSyncs).toFixed(2))
    : 0;

  const lastSync = syncEntries[0]
    ? {
        timestamp: syncEntries[0].timestamp.toISOString(),
        conformity: syncEntries[0].conformity,
        completion: syncEntries[0].completion,
        note: syncEntries[0].note ?? null,
      }
    : null;

  const recentSyncs = syncEntries.slice(0, 5).map((entry) => ({
    timestamp: entry.timestamp.toISOString(),
    conformity: entry.conformity,
    completion: entry.completion,
    note: entry.note ?? null,
  }));

  return {
    responsesCount,
    actionPlans: {
      total: actionPlansTotal,
      byStatus,
      bySeverity,
      overdue,
      recent: recentPlans,
    },
    sync: {
      total: totalSyncs,
      avgConformity,
      avgCompletion,
      lastSync,
      recent: recentSyncs,
    },
  };
}

function mapActorContext(auth, companyId) {
  if (!auth) {
    return null;
  }
  return {
    id: auth.userId,
    role: auth.role,
    companyId: companyId ?? auth.companyId ?? null,
  };
}

app.get(
  "/companies",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL),
  async (req, res) => {
    const search = normalizeText(req.query.search ?? "");

    const where = search
      ? {
          OR: [
            { nomeFantasia: { contains: search, mode: "insensitive" } },
            { razaoSocial: { contains: search, mode: "insensitive" } },
            { cnpj: { contains: search.replace(/\D/g, "") } },
            { code: { contains: search.toUpperCase() } },
          ],
        }
      : {};

    try {
      const companies = await prisma.company.findMany({
        where,
        orderBy: { nomeFantasia: "asc" },
      });
      res.json({ companies: companies.map(mapCompany) });
    } catch (error) {
      console.error("Failed to list companies", error);
      res.status(500).json({ message: "Erro ao listar empresas" });
    }
  }
);

app.post(
  "/companies",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL),
  async (req, res) => {
    const { nomeFantasia, razaoSocial, cnpj, code, adminUser } = req.body ?? {};

    const normalizedNome = normalizeText(nomeFantasia);
    const normalizedRazao = normalizeText(razaoSocial);
    const sanitizedCnpj = sanitizeCnpj(cnpj);
    const explicitCode = normalizeCompanyCode(code);

    if (!normalizedNome || !normalizedRazao || sanitizedCnpj.length !== 14) {
      return res.status(400).json({ message: "Informe nome fantasia, razão social e CNPJ válidos" });
    }

    let adminPayload = null;
    if (adminUser) {
      const adminName = normalizeText(adminUser.name);
      const adminLogin = normalizeLogin(adminUser.login);
      if (!adminName || !adminLogin || !isValidPassword(adminUser.password)) {
        return res
          .status(400)
          .json({ message: "Dados do usuário administrador inválidos (nome, login, senha)" });
      }
      const passwordHash = await hashPassword(adminUser.password);
      adminPayload = {
        name: adminName,
        login: adminLogin,
        email: normalizeEmail(adminUser.email),
        passwordHash,
        role: UserRole.COMPANY_ADMIN,
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const companyCode = explicitCode ?? (await generateUniqueCompanyCode(tx));

        const company = await tx.company.create({
          data: {
            code: companyCode,
            nomeFantasia: normalizedNome,
            razaoSocial: normalizedRazao,
            cnpj: sanitizedCnpj,
          },
        });

        let createdUser = null;
        if (adminPayload) {
          createdUser = await tx.user.create({
            data: {
              ...adminPayload,
              companyId: company.id,
            },
          });
        }

        return { company, createdUser };
      });

      res.status(201).json({
        company: mapCompany(result.company),
        adminUser: result.createdUser ? mapUserSummary(result.createdUser) : null,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ message: "Empresa, CNPJ ou login já cadastrado" });
      }
      console.error("Failed to create company", error);
      res.status(500).json({ message: "Erro ao criar empresa" });
    }
  }
);

app.get(
  "/companies/:companyId",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL),
  async (req, res) => {
    try {
      const company = await prisma.company.findUnique({ where: { id: String(req.params.companyId) } });
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }
      res.json({ company: mapCompany(company) });
    } catch (error) {
      console.error("Failed to load company", error);
      res.status(500).json({ message: "Erro ao carregar empresa" });
    }
  }
);

app.post(
  "/companies/:companyId/users",
  authenticate,
  async (req, res) => {
    const { companyId } = req.params;
    const { name, login, password, email, role = UserRole.USER } = req.body ?? {};

    const normalizedName = normalizeText(name);
    const normalizedLogin = normalizeLogin(login);

    if (!normalizedName || !normalizedLogin || !isValidPassword(password)) {
      return res.status(400).json({ message: "Nome, login ou senha inválidos" });
    }

    try {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      const requester = req.auth;
      if (!requester) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      let targetRole = role;
      if (requester.role === UserRole.ADMIN_GLOBAL) {
        if (targetRole === UserRole.ADMIN_GLOBAL) {
          targetRole = UserRole.COMPANY_ADMIN;
        }
      } else {
        if (requester.companyId !== company.id || requester.role !== UserRole.COMPANY_ADMIN) {
          return res.status(403).json({ message: "Sem permissão para criar usuário" });
        }
        targetRole = role === UserRole.COMPANY_ADMIN ? UserRole.COMPANY_ADMIN : UserRole.USER;
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          name: normalizedName,
          login: normalizedLogin,
          email: normalizeEmail(email),
          passwordHash,
          role: targetRole,
          companyId: company.id,
        },
      });

      res.status(201).json({ user: mapUserSummary(user) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ message: "Login ou e-mail já cadastrado" });
      }
      console.error("Failed to create user", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  }
);

app.post("/auth/signup", async (req, res) => {
  const { cnpj, email, login, password, nomeFantasia, razaoSocial } = req.body ?? {};

  // Validações
  if (!cnpj || !validateCNPJ(cnpj)) {
    return res.status(400).json({ message: "CNPJ inválido" });
  }

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ message: "E-mail inválido" });
  }

  const normalizedLogin = normalizeLogin(login);
  if (!normalizedLogin) {
    return res.status(400).json({ message: "Login inválido" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
  }

  try {
    // Verificar se CNPJ já existe
    const existingCompany = await prisma.company.findUnique({
      where: { cnpj: cnpj.replace(/\D/g, '') },
    });

    // Verificar se login ou email já existem
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { login: normalizedLogin },
          { email },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Login ou e-mail já cadastrado" });
    }

    let company;
    let user;
    let isNewCompany = false;

    // Hash da senha
    const passwordHash = await hashPassword(password);

    if (existingCompany) {
      // Empresa já existe, apenas criar usuário
      company = existingCompany;
      user = await prisma.user.create({
        data: {
          name: nomeFantasia || login,
          login: normalizedLogin,
          email,
          passwordHash,
          role: UserRole.USER, // Novos usuários em empresa existente são USER
          companyId: company.id,
        },
      });
    } else {
      // Criar nova empresa e usuário
      isNewCompany = true;
      const companyCode = generateCompanyCode(cnpj);

      // Verificar se o código gerado já existe (improvável, mas possível)
      const codeExists = await prisma.company.findUnique({
        where: { code: companyCode },
      });

      if (codeExists) {
        return res.status(409).json({ message: "Código da empresa já existe. Entre em contato com o suporte." });
      }

      const result = await prisma.$transaction(async (tx) => {
        const newCompany = await tx.company.create({
          data: {
            code: companyCode,
            cnpj: cnpj.replace(/\D/g, ''),
            nomeFantasia: nomeFantasia || `Empresa ${companyCode}`,
            razaoSocial: razaoSocial || nomeFantasia || `Empresa ${companyCode}`,
          },
        });

        const newUser = await tx.user.create({
          data: {
            name: nomeFantasia || login,
            login: normalizedLogin,
            email,
            passwordHash,
            role: UserRole.COMPANY_ADMIN, // Primeiro usuário é admin
            companyId: newCompany.id,
          },
        });

        return { company: newCompany, user: newUser };
      });

      company = result.company;
      user = result.user;
    }

    // Enviar email de boas-vindas
    if (isEmailConfigured()) {
      try {
        await sendWelcomeEmail({
          to: email,
          name: user.name,
          login: user.login,
          companyCode: company.code,
          companyName: company.nomeFantasia,
          isNewCompany,
        });
      } catch (emailError) {
        console.error("Erro ao enviar email de boas-vindas:", emailError);
        // Não falhar o cadastro se o email falhar
      }
    }

    // Gerar token
    const token = signToken({
      id: user.id,
      role: user.role,
      companyId: company.id,
      name: user.name,
      email: user.email,
    });

    res.status(201).json({
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: buildUserPayload(user, company),
      companyCode: company.code,
      message: isNewCompany
        ? `Cadastro realizado com sucesso! Seu código de empresa é: ${company.code}. Um email foi enviado com suas credenciais.`
        : `Usuário adicionado à empresa ${company.nomeFantasia} com sucesso! Um email foi enviado com suas credenciais.`,
    });
  } catch (error) {
    console.error("Failed to signup", error);
    res.status(500).json({ message: "Erro ao realizar cadastro" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { companyCode, login, password } = req.body ?? {};

  const normalizedLogin = normalizeLogin(login);
  const normalizedCode = normalizeCompanyCode(companyCode);

  if (!normalizedLogin || typeof password !== "string") {
    return res.status(400).json({ message: "Informe login e senha válidos" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { login: normalizedLogin },
      include: { company: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    let company = user.company ?? null;

    if (user.role === UserRole.ADMIN_GLOBAL) {
      if (normalizedCode) {
        company = await prisma.company.findUnique({ where: { code: normalizedCode } });
        if (!company) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }
      }
    } else {
      if (!user.companyId) {
        return res.status(403).json({ message: "Usuário sem empresa vinculada" });
      }
      if (!normalizedCode) {
        return res.status(400).json({ message: "Informe o código da empresa" });
      }
      company = await prisma.company.findFirst({
        where: { id: user.companyId, code: normalizedCode },
      });
      if (!company) {
        return res.status(401).json({ message: "Empresa inválida" });
      }
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      companyId:
        user.role === UserRole.ADMIN_GLOBAL
          ? company?.id ?? null
          : user.companyId,
      name: user.name,
      email: user.email,
    });

    res.json({
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: buildUserPayload(user, company ?? undefined),
    });
  } catch (error) {
    console.error("Failed to login", error);
    res.status(500).json({ message: "Erro ao autenticar" });
  }
});

app.get("/auth/profile", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { company: true },
    });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.json({ user: buildUserPayload(user, user.company ?? undefined) });
  } catch (error) {
    console.error("Failed to load profile", error);
    res.status(500).json({ message: "Erro ao carregar perfil" });
  }
});

// Solicitar recuperação de senha
app.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ message: "E-mail inválido" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Por segurança, sempre retornar sucesso mesmo se o email não existir
    if (!user) {
      return res.json({ message: "Se o e-mail existir, você receberá instruções para redefinir sua senha." });
    }

    // Gerar token único
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar token no banco
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Enviar email
    if (isEmailConfigured()) {
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetToken: token,
        });
      } catch (emailError) {
        console.error("Erro ao enviar email de recuperação:", emailError);
        return res.status(500).json({ message: "Erro ao enviar e-mail de recuperação" });
      }
    } else {
      console.warn("Email não configurado, não foi possível enviar recuperação");
      return res.status(503).json({ message: "Serviço de e-mail não configurado" });
    }

    res.json({ message: "Se o e-mail existir, você receberá instruções para redefinir sua senha." });
  } catch (error) {
    console.error("Failed to request password reset", error);
    res.status(500).json({ message: "Erro ao solicitar recuperação de senha" });
  }
});

// Redefinir senha com token
app.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body ?? {};

  if (!token) {
    return res.status(400).json({ message: "Token inválido" });
  }

  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ message: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
  }

  try {
    // Buscar token
    const passwordReset = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!passwordReset) {
      return res.status(400).json({ message: "Token inválido ou expirado" });
    }

    // Verificar se já foi usado
    if (passwordReset.used) {
      return res.status(400).json({ message: "Este link já foi utilizado" });
    }

    // Verificar se expirou
    if (passwordReset.expiresAt < new Date()) {
      return res.status(400).json({ message: "Este link expirou. Solicite uma nova recuperação de senha." });
    }

    // Hash da nova senha
    const passwordHash = await hashPassword(newPassword);

    // Atualizar senha e marcar token como usado
    await prisma.$transaction([
      prisma.user.update({
        where: { id: passwordReset.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { used: true },
      }),
    ]);

    res.json({ message: "Senha redefinida com sucesso!" });
  } catch (error) {
    console.error("Failed to reset password", error);
    res.status(500).json({ message: "Erro ao redefinir senha" });
  }
});

// Alterar senha (usuário logado)
app.post("/auth/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "A nova senha deve ter no mínimo 6 caracteres" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    // Gerar hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: "Senha alterada com sucesso!" });
  } catch (error) {
    console.error("Failed to change password", error);
    res.status(500).json({ message: "Erro ao alterar senha" });
  }
});

// Criar usuário (Admin Global ou via signup)
app.post("/auth/register", authenticate, async (req, res) => {
  // Apenas Admin Global pode criar usuários por este endpoint
  if (req.user.role !== "ADMIN_GLOBAL") {
    return res.status(403).json({ message: "Acesso negado" });
  }

  const { name, email, password, role, companyId } = req.body ?? {};

  // Validações
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, email e senha são obrigatórios" });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: "Email inválido" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` });
  }

  if (role === "ADMIN_COMPANY" && !companyId) {
    return res.status(400).json({ message: "CompanyId é obrigatório para Admin de Empresa" });
  }

  try {
    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    // Gerar login a partir do email
    const login = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name,
        login,
        email,
        passwordHash,
        role: role || "ADMIN_COMPANY",
        companyId: role === "ADMIN_GLOBAL" ? null : companyId,
      },
      include: {
        company: true,
      },
    });

    // Enviar email com credenciais
    if (isEmailConfigured()) {
      try {
        await sendWelcomeEmail({
          to: email,
          name: user.name,
          login: user.login,
          companyCode: user.company?.code || "N/A",
          companyName: user.company?.nomeFantasia || "Admin Global",
          isNewCompany: false,
        });
      } catch (emailError) {
        console.error("Erro ao enviar email:", emailError);
      }
    }

    res.status(201).json({
      message: "Usuário criado com sucesso!",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company ? {
          id: user.company.id,
          nomeFantasia: user.company.nomeFantasia,
          cnpj: user.company.cnpj,
        } : null,
      },
    });
  } catch (error) {
    console.error("Failed to create user", error);
    res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

// Listar todas as empresas (Admin Global apenas)
app.get("/companies", authenticate, async (req, res) => {
  if (req.user.role !== "ADMIN_GLOBAL") {
    return res.status(403).json({ message: "Acesso negado" });
  }

  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        code: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
      },
      orderBy: { nomeFantasia: "asc" },
    });

    res.json({ companies });
  } catch (error) {
    console.error("Failed to list companies", error);
    res.status(500).json({ message: "Erro ao listar empresas" });
  }
});

app.get(
  "/companies/import/template",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL),
  async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Ativa NR-1";
      workbook.created = new Date();

      const instructionsSheet = workbook.addWorksheet("Instruções");
      instructionsSheet.getColumn(1).width = 100;
      instructionsSheet.addRows([
        [
          "Como usar esta planilha:",
        ],
        [
          "1. Preencha a aba 'Clientes' com os dados necessários. Campos marcados com * são obrigatórios.",
        ],
        [
          "2. Utilize apenas um questionário por importação (escolhido no aplicativo).",
        ],
        [
          "3. Formatos válidos: CNPJ com 14 dígitos (com ou sem pontuação) e e-mail válido.",
        ],
        [
          "4. CPF, Nome e Nome Fantasia/Razão Social são opcionais, mas recomendados para personalização.",
        ],
        [
          "5. Após importar, cada contato receberá um e-mail com link para preencher o questionário selecionado.",
        ],
      ]);
      instructionsSheet.getRow(1).font = { bold: true };

      const dataSheet = workbook.addWorksheet("Clientes");
      dataSheet.columns = [
        { header: "CNPJ *", key: "cnpj", width: 22 },
        { header: "Email *", key: "email", width: 32 },
        { header: "CPF", key: "cpf", width: 18 },
        { header: "Nome", key: "nome", width: 28 },
        { header: "Nome Fantasia / Razão Social", key: "nomeFantasia", width: 32 },
      ];
      dataSheet.getRow(1).font = { bold: true };
      dataSheet.addRow({
        cnpj: "12.345.678/0001-90",
        email: "contato@empresa.com",
        cpf: "123.456.789-00",
        nome: "Maria Silva",
        nomeFantasia: "Empresa Exemplo LTDA",
      });
      dataSheet.addRow({
        cnpj: "98.765.432/0001-10",
        email: "atendimento@outrocliente.com",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=importacao_clientes_template.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Failed to generate import template", error);
      res.status(500).json({ message: "Erro ao gerar template de importação" });
    }
  }
);

app.post(
  "/companies/import",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }

    const { questionnaireId, questionnaireName } = req.body;
    if (!questionnaireId || !questionnaireName) {
      return res.status(400).json({ message: "Questionário não selecionado" });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const worksheet = workbook.getWorksheet('Clientes');
      if (!worksheet) {
        return res.status(400).json({ message: "Aba 'Clientes' não encontrada na planilha" });
      }

      const results = [];
      let totalRows = 0;
      let successCount = 0;
      let errorCount = 0;

      // Pular header (linha 1)
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.values.every(cell => !cell)) continue;

        totalRows++;
        const rowData = {
          cnpj: row.getCell(1).value?.toString().trim() || '',
          email: row.getCell(2).value?.toString().trim() || '',
          cpf: row.getCell(3).value?.toString().trim() || '',
          nome: row.getCell(4).value?.toString().trim() || '',
          nomeFantasia: row.getCell(5).value?.toString().trim() || '',
        };

        const errors = [];

        // Validações
        if (!rowData.cnpj) {
          errors.push('CNPJ é obrigatório');
        } else if (!validateCNPJ(rowData.cnpj)) {
          errors.push('CNPJ inválido');
        }

        if (!rowData.email) {
          errors.push('Email é obrigatório');
        } else if (!validateEmail(rowData.email)) {
          errors.push('Email inválido');
        }

        if (errors.length > 0) {
          results.push({
            row: rowNumber,
            status: 'error',
            errors,
            data: rowData
          });
          errorCount++;
          continue;
        }

        try {
          // Verificar se empresa já existe
          const cnpjLimpo = sanitizeCnpj(rowData.cnpj);
          let company = await prisma.company.findUnique({
            where: { cnpj: cnpjLimpo }
          });

          if (!company) {
            // Criar nova empresa
            const companyCode = generateCompanyCode(cnpjLimpo);
            const nomeFantasia = rowData.nomeFantasia || `Empresa ${companyCode}`;
            const razaoSocial = rowData.nomeFantasia || nomeFantasia;

            company = await prisma.company.create({
              data: {
                code: companyCode,
                nomeFantasia,
                razaoSocial,
                cnpj: cnpjLimpo,
              }
            });
          }

          // Verificar se usuário já existe
          const normalizedEmail = normalizeEmail(rowData.email);
          let user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
          });

          if (!user) {
            // Gerar token para acesso ao questionário
            const questionnaireToken = generateQuestionnaireToken();
            
            // Criar usuário com token
            const tempPassword = generateTemporaryPassword();
            const login = normalizedEmail.split('@')[0] + '_' + randomUUID().slice(0, 8);
            
            user = await prisma.user.create({
              data: {
                name: rowData.nome || 'Contato da Empresa',
                login: normalizeLogin(login),
                email: normalizedEmail,
                passwordHash: await hashPassword(tempPassword),
                role: UserRole.USER,
                companyId: company.id,
                questionnaireToken,
              }
            });

            // Enviar email de convite
            try {
              await sendQuestionnaireInvitationEmail({
                to: normalizedEmail,
                name: user.name,
                companyCode: company.code,
                companyName: company.nomeFantasia,
                questionnaireToken,
                questionnaireName,
              });

              results.push({
                row: rowNumber,
                status: 'success',
                message: 'Empresa e usuário criados com sucesso. Email enviado.',
                data: {
                  companyCode: company.code,
                  companyName: company.nomeFantasia,
                  userEmail: user.email,
                  userName: user.name,
                }
              });
              successCount++;
            } catch (emailError) {
              console.error('Erro ao enviar email:', emailError);
              results.push({
                row: rowNumber,
                status: 'warning',
                message: 'Empresa e usuário criados, mas falha ao enviar email.',
                errors: [emailError.message],
                data: {
                  companyCode: company.code,
                  companyName: company.nomeFantasia,
                  userEmail: user.email,
                  userName: user.name,
                }
              });
              successCount++;
            }
          } else {
            // Usuário já existe - gerar novo token
            const questionnaireToken = generateQuestionnaireToken();
            
            await prisma.user.update({
              where: { id: user.id },
              data: { questionnaireToken }
            });

            // Enviar email com novo token
            try {
              await sendQuestionnaireInvitationEmail({
                to: normalizedEmail,
                name: user.name,
                companyCode: company.code,
                companyName: company.nomeFantasia,
                questionnaireToken,
                questionnaireName,
              });

              results.push({
                row: rowNumber,
                status: 'success',
                message: 'Usuário já existe. Novo token gerado e email enviado.',
                data: {
                  companyCode: company.code,
                  companyName: company.nomeFantasia,
                  userEmail: user.email,
                  userName: user.name,
                }
              });
              successCount++;
            } catch (emailError) {
              console.error('Erro ao enviar email:', emailError);
              results.push({
                row: rowNumber,
                status: 'warning',
                message: 'Novo token gerado, mas falha ao enviar email.',
                errors: [emailError.message],
                data: {
                  companyCode: company.code,
                  companyName: company.nomeFantasia,
                  userEmail: user.email,
                  userName: user.name,
                }
              });
              successCount++;
            }
          }
        } catch (dbError) {
          console.error('Erro ao processar linha:', rowNumber, dbError);
          results.push({
            row: rowNumber,
            status: 'error',
            errors: ['Erro interno: ' + dbError.message],
            data: rowData
          });
          errorCount++;
        }
      }

      res.json({
        summary: {
          total: totalRows,
          success: successCount,
          errors: errorCount,
        },
        results
      });
    } catch (error) {
      console.error("Failed to process import", error);
      res.status(500).json({ message: "Erro ao processar importação" });
    }
  }
);

// Listar todos os usuários (Admin Global apenas)
app.get("/users", authenticate, async (req, res) => {
  if (req.user.role !== "ADMIN_GLOBAL") {
    return res.status(403).json({ message: "Acesso negado" });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            nomeFantasia: true,
            cnpj: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    console.error("Failed to list users", error);
    res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

// Deletar usuário (Admin Global apenas)
app.delete("/users/:id", authenticate, async (req, res) => {
  if (req.user.role !== "ADMIN_GLOBAL") {
    return res.status(403).json({ message: "Acesso negado" });
  }

  const { id } = req.params;

  // Não permitir deletar a si mesmo
  if (id === req.user.id) {
    return res.status(400).json({ message: "Você não pode deletar sua própria conta" });
  }

  try {
    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "Usuário deletado com sucesso" });
  } catch (error) {
    console.error("Failed to delete user", error);
    res.status(500).json({ message: "Erro ao deletar usuário" });
  }
});

// Endpoint temporário para resetar senha do admin (REMOVER DEPOIS)
app.post("/auth/emergency-reset", async (req, res) => {
  const { email, newPassword, secretKey } = req.body ?? {};

  // Chave secreta para segurança (use uma variável de ambiente em produção)
  const EMERGENCY_SECRET = process.env.EMERGENCY_SECRET || "ativa-emergency-2024";

  if (secretKey !== EMERGENCY_SECRET) {
    return res.status(403).json({ message: "Chave secreta inválida" });
  }

  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email e nova senha são obrigatórios" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({
      message: "Senha resetada com sucesso!",
      user: {
        name: user.name,
        email: user.email,
        login: user.login,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Failed to reset password", error);
    res.status(500).json({ message: "Erro ao resetar senha" });
  }
});

app.get(
  "/state",
  authenticate,
  async (req, res) => {
    try {
      // Verificar se req.user existe
      if (!req.user) {
        console.error("req.user is undefined - authentication failed");
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Admin Global sem empresa selecionada retorna dados vazios
      if (req.user.role === "ADMIN_GLOBAL" && !req.query.companyId && !req.query.companyCode) {
        return res.json({ responses: {}, syncHistory: [], actionPlans: [] });
      }

      // Obter companyId
      let companyId;
      if (req.user.role === "ADMIN_GLOBAL") {
        if (req.query.companyId) {
          companyId = req.query.companyId;
        } else if (req.query.companyCode) {
          const company = await prisma.company.findUnique({
            where: { code: req.query.companyCode },
          });
          if (!company) {
            return res.status(404).json({ message: "Empresa não encontrada" });
          }
          companyId = company.id;
        }
      } else {
        companyId = req.user.companyId;
      }

      if (!companyId) {
        return res.status(400).json({ message: "Informe companyId ou companyCode para acessar dados de uma empresa" });
      }

      const [responseRows, syncRows, planRows, ruleRows] = await Promise.all([
        prisma.questionResponse.findMany({
          where: { questionnaire: DEFAULT_QUESTIONNAIRE, companyId },
        }),
        prisma.syncEntry.findMany({
          where: { companyId },
          orderBy: { timestamp: "desc" },
        }),
        prisma.actionPlan.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.conditionalLogicRule.findMany({
          where: { companyId },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      const responses = {};
      for (const record of responseRows) {
        if (!responses[record.sectionId]) {
          responses[record.sectionId] = {};
        }
        const entry = {};
        const value = normalizeValue(record);
        if (value !== undefined) {
          entry.value = value;
        }
        if (record.attachmentName) {
          entry.attachmentName = record.attachmentName;
        }
        if (record.attachmentData) {
          entry.attachmentData = record.attachmentData;
        }
        responses[record.sectionId][record.questionId] = entry;
      }

      const syncHistory = syncRows.map((item) => ({
        timestamp: item.timestamp.toISOString(),
        conformity: item.conformity,
        completion: item.completion,
        note: item.note ?? undefined,
      }));

      const actionPlans = planRows.map(mapActionPlan);

      const conditionalRules = ruleRows.map((rule) => ({
        id: rule.id,
        sectionId: rule.sectionId,
        targetQuestionId: rule.targetQuestionId,
        action: rule.action,
        actionPayload: rule.actionPayload ?? undefined,
        conditions: Array.isArray(rule.conditions) ? rule.conditions : [],
        enabled: rule.enabled,
        name: rule.name ?? undefined,
        description: rule.description ?? undefined,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      }));

      res.json({ responses, syncHistory, actionPlans, conditionalRules });
    } catch (error) {
      console.error("Failed to fetch state - Error details:", error);
      console.error("User:", req.user);
      console.error("Query:", req.query);
      res.status(500).json({ 
        message: "Failed to fetch state",
        error: error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  }
);

// GET endpoint para buscar o último insight
app.get(
  "/companies/:companyId/insights",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL, UserRole.COMPANY_ADMIN, UserRole.USER),
  async (req, res) => {
    const targetCompanyId = String(req.params.companyId);

    if (req.auth.role !== UserRole.ADMIN_GLOBAL && req.auth.companyId !== targetCompanyId) {
      return res.status(403).json({ message: "Sem permissão para acessar insights de outra empresa" });
    }

    try {
      const latestInsight = await prisma.companyInsight.findFirst({
        where: { companyId: targetCompanyId },
        orderBy: { createdAt: "desc" },
      });

      if (!latestInsight) {
        return res.json({ suggestions: null, createdAt: null });
      }

      res.json({
        suggestions: latestInsight.suggestions,
        createdAt: latestInsight.createdAt,
        focus: latestInsight.focus,
      });
    } catch (error) {
      console.error("Failed to fetch insights", error);
      res.status(500).json({ message: "Erro ao buscar insights" });
    }
  }
);

// POST endpoint para gerar novos insights
app.post(
  "/companies/:companyId/insights",
  authenticate,
  requireRoles(UserRole.ADMIN_GLOBAL, UserRole.COMPANY_ADMIN, UserRole.USER),
  async (req, res) => {
    if (!isAiConfigured()) {
      return res.status(503).json({ message: "IA não configurada" });
    }

    const targetCompanyId = String(req.params.companyId);
    const actor = mapActorContext(req.auth, targetCompanyId);

    if (req.auth.role !== UserRole.ADMIN_GLOBAL && req.auth.companyId !== targetCompanyId) {
      return res.status(403).json({ message: "Sem permissão para gerar insights para outra empresa" });
    }

    try {
      const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      const metrics = await buildCompanyMetrics(targetCompanyId);

      const suggestions = await generateCompanyInsights({
        company,
        metrics,
        focus: normalizeText(req.body?.focus) ?? undefined,
        actor,
        limit: Number(req.body?.limit ?? DEFAULT_AI_LIMIT),
      });

      // Salvar insight no banco
      await prisma.companyInsight.create({
        data: {
          companyId: targetCompanyId,
          suggestions,
          focus: normalizeText(req.body?.focus) ?? null,
          generatedBy: actor?.id ?? null,
        },
      });

      res.json({ suggestions });
    } catch (error) {
      console.error("Failed to generate AI insights", error);
      res.status(500).json({ message: "Erro ao gerar insights", details: error.message });
    }
  }
);

app.post(
  "/state",
  authenticate,
  withCompany(async (req, res, companyId) => {
    const { responses = {}, syncHistory = [], actionPlans = [], conditionalRules = [] } = req.body ?? {};

    try {
      const responseRows = [];
      for (const [sectionId, sectionResponses] of Object.entries(responses)) {
        if (!sectionResponses || typeof sectionResponses !== "object") {
          continue;
        }
        for (const [questionId, response] of Object.entries(sectionResponses)) {
          if (!response || typeof response !== "object") {
            continue;
          }
          const value = response.value;
          responseRows.push({
            questionnaire: DEFAULT_QUESTIONNAIRE,
            sectionId,
            questionId,
            valueNumber: typeof value === "number" ? value : undefined,
            valueString: typeof value === "string" ? value : undefined,
            attachmentName: response.attachmentName ?? undefined,
            attachmentData: response.attachmentData ?? undefined,
            companyId,
          });
        }
      }

      const syncRows = syncHistory.map((item) => ({
        timestamp: toDate(item.timestamp) ?? new Date(),
        conformity: Number(item.conformity) || 0,
        completion: Number(item.completion) || 0,
        note: item.note ?? undefined,
        companyId,
      }));

      const planRows = actionPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        problemDescription: plan.problemDescription,
        normativeItem: normalizeText(plan.normativeItem) ?? undefined,
        unitOrSector: normalizeText(plan.unitOrSector) ?? undefined,
        correctiveAction: plan.correctiveAction,
        severity: plan.severity,
        status: plan.status,
        dueDate: toDate(plan.dueDate),
        responsible: plan.responsible,
        notes: normalizeText(plan.notes) ?? undefined,
        createdAt: toDate(plan.createdAt) ?? new Date(),
        companyId,
      }));

      const ruleRows = conditionalRules.map((rule) => ({
        id: rule.id,
        companyId,
        sectionId: rule.sectionId,
        targetQuestionId: rule.targetQuestionId,
        action: rule.action,
        actionPayload: rule.actionPayload ?? undefined,
        conditions: rule.conditions ?? [],
        enabled: rule.enabled !== false,
        name: normalizeText(rule.name) ?? undefined,
        description: normalizeText(rule.description) ?? undefined,
        createdAt: toDate(rule.createdAt) ?? new Date(),
        updatedAt: toDate(rule.updatedAt) ?? new Date(),
      }));

      await prisma.$transaction(async (tx) => {
        await tx.questionResponse.deleteMany({
          where: {
            questionnaire: DEFAULT_QUESTIONNAIRE,
            companyId,
          },
        });
        if (responseRows.length > 0) {
          await tx.questionResponse.createMany({ data: responseRows });
        }

        await tx.syncEntry.deleteMany({ where: { companyId } });
        if (syncRows.length > 0) {
          await tx.syncEntry.createMany({ data: syncRows });
        }

        await tx.actionPlan.deleteMany({ where: { companyId } });
        if (planRows.length > 0) {
          await tx.actionPlan.createMany({ data: planRows });
        }

        await tx.conditionalLogicRule.deleteMany({ where: { companyId } });
        if (ruleRows.length > 0) {
          await tx.conditionalLogicRule.createMany({ data: ruleRows });
        }
      });

      res.status(204).end();
    } catch (error) {
      console.error("Failed to persist state", error);
      res.status(500).json({ message: "Failed to persist state" });
    }
  })
);

app.get(
  "/reports/export/all.zip",
  authenticate,
  withCompany(async (req, res, companyId) => {
    try {
      const company = req.company ?? (await prisma.company.findUnique({ where: { id: companyId } }));
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      const [responses, syncHistory, actionPlans, insights, trainings, certificates] = await Promise.all([
        prisma.questionResponse.findMany({
          where: { companyId, questionnaire: DEFAULT_QUESTIONNAIRE },
          orderBy: [{ sectionId: "asc" }, { questionId: "asc" }],
        }),
        prisma.syncEntry.findMany({ where: { companyId }, orderBy: { timestamp: "desc" } }),
        prisma.actionPlan.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } }),
        prisma.companyInsight.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
        prisma.training.findMany({
          where: { userProgress: { some: { user: { companyId } } } },
          include: {
            quizzes: {
              include: {
                attempts: {
                  where: { user: { companyId } },
                  orderBy: { completedAt: "desc" },
                },
              },
            },
            userProgress: {
              where: { user: { companyId } },
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        }),
        prisma.certificate.findMany({
          where: { user: { companyId } },
          include: {
            training: { select: { title: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { issuedAt: "desc" },
        }),
      ]);

      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (error) => {
        console.error("Failed to stream reports ZIP", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Erro ao gerar pacote de relatórios", details: error.message });
        }
      });

      res.setHeader("Content-Type", "application/zip");
      const filename = `ativa-relatorios-${company.code.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.zip`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      archive.pipe(res);

      archive.append(
        JSON.stringify(
          {
            company: {
              id: company.id,
              code: company.code,
              nomeFantasia: company.nomeFantasia,
              razaoSocial: company.razaoSocial,
              cnpj: company.cnpj,
              generatedAt: new Date().toISOString(),
            },
            totals: {
              responses: responses.length,
              syncEntries: syncHistory.length,
              actionPlans: actionPlans.length,
              insights: insights.length,
              trainings: trainings.length,
              certificates: certificates.length,
            },
          },
          null,
          2
        ),
        { name: "summary.json" }
      );

      archive.append(JSON.stringify(responses, null, 2), { name: "questionnaire-responses.json" });
      archive.append(JSON.stringify(syncHistory, null, 2), { name: "sync-history.json" });
      archive.append(JSON.stringify(actionPlans, null, 2), { name: "action-plans.json" });
      archive.append(JSON.stringify(insights, null, 2), { name: "ia-insights.json" });
      archive.append(JSON.stringify(trainings, null, 2), { name: "trainings-progress.json" });
      archive.append(JSON.stringify(certificates, null, 2), { name: "certificates.json" });

      archive.finalize();
    } catch (error) {
      console.error("Failed to export reports ZIP", error);
      res.status(500).json({ message: "Erro ao exportar relatórios", details: error.message });
    }
  })
);

app.post(
  "/sync",
  authenticate,
  withCompany(async (req, res, companyId) => {
    const entry = req.body;
    if (!entry?.timestamp) {
      return res.status(400).json({ message: "Invalid sync entry" });
    }

    try {
      await prisma.syncEntry.create({
        data: {
          timestamp: toDate(entry.timestamp) ?? new Date(),
          conformity: Number(entry.conformity) || 0,
          completion: Number(entry.completion) || 0,
          note: entry.note ?? undefined,
          companyId,
        },
      });

      const overflow = await prisma.syncEntry.findMany({
        where: { companyId },
        orderBy: { timestamp: "desc" },
        skip: MAX_SYNC_HISTORY,
        select: { id: true },
      });

      if (overflow.length > 0) {
        await prisma.syncEntry.deleteMany({
          where: {
            companyId,
            id: { in: overflow.map((item) => item.id) },
          },
        });
      }

      res.status(201).json({ message: "Sync stored" });
    } catch (error) {
      console.error("Failed to append sync entry", error);
      res.status(500).json({ message: "Failed to append sync entry" });
    }
  })
);

app.get(
  "/action-plans",
  authenticate,
  withCompany(async (_req, res, companyId) => {
    try {
      const plans = await prisma.actionPlan.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
      });
      res.json(plans.map(mapActionPlan));
    } catch (error) {
      console.error("Failed to list action plans", error);
      res.status(500).json({ message: "Failed to list action plans" });
    }
  })
);

app.post(
  "/action-plans",
  authenticate,
  withCompany(async (req, res, companyId) => {
    const plan = req.body;
    if (!plan?.id) {
      return res.status(400).json({ message: "Action plan must include an id" });
    }

    try {
      const normalized = {
        title: plan.title,
        problemDescription: plan.problemDescription,
        normativeItem: normalizeText(plan.normativeItem) ?? undefined,
        unitOrSector: normalizeText(plan.unitOrSector) ?? undefined,
        correctiveAction: plan.correctiveAction,
        severity: plan.severity,
        status: plan.status,
        dueDate: toDate(plan.dueDate),
        responsible: plan.responsible,
        notes: normalizeText(plan.notes) ?? undefined,
      };

      const existing = await prisma.actionPlan.findUnique({ where: { id: plan.id } });
      if (existing && existing.companyId !== companyId) {
        return res.status(403).json({ message: "Plano de outra empresa" });
      }

      let saved;
      if (existing) {
        saved = await prisma.actionPlan.update({
          where: { id: plan.id },
          data: normalized,
        });
      } else {
        saved = await prisma.actionPlan.create({
          data: {
            id: plan.id,
            ...normalized,
            createdAt: toDate(plan.createdAt) ?? undefined,
            companyId,
          },
        });
      }

      res.status(201).json(mapActionPlan(saved));
    } catch (error) {
      console.error("Failed to persist action plan", error);
      res.status(500).json({ message: "Failed to persist action plan" });
    }
  })
);

app.delete(
  "/action-plans/:id",
  authenticate,
  withCompany(async (req, res, companyId) => {
    const { id } = req.params;

    try {
      const existing = await prisma.actionPlan.findUnique({ where: { id } });
      if (!existing) {
        return res.status(204).end();
      }
      if (existing.companyId !== companyId) {
        return res.status(404).json({ message: "Plano não encontrado" });
      }

      await prisma.actionPlan.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      console.error("Failed to remove action plan", error);
      res.status(500).json({ message: "Failed to remove action plan" });
    }
  })
);

// Rota pública para acesso ao questionário via token
app.get("/questionnaire/token/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { questionnaireToken: token },
      include: {
        company: {
          select: {
            id: true,
            code: true,
            nomeFantasia: true,
            razaoSocial: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: "Token inválido ou expirado" });
    }

    if (!user.company) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    // Gerar JWT temporário para acesso ao questionário
    const tempToken = signToken({
      id: user.id,
      role: user.role,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      company: user.company,
      token: tempToken,
    });
  } catch (error) {
    console.error("Failed to validate questionnaire token", error);
    res.status(500).json({ message: "Erro ao validar token" });
  }
});

// Endpoints para Treinamentos (EAD)
app.get("/trainings", authenticate, async (req, res) => {
  try {
    const { companyId } = req;
    
    let trainings;
    const includeOpts = {
      include: {
        _count: {
          select: {
            userProgress: true,
            certificates: true,
          },
        },
        quizzes: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    };

    if (req.auth.role === "ADMIN_GLOBAL") {
      // Admin global vê todos os treinamentos
      trainings = await prisma.training.findMany({
        where: {},
        ...includeOpts,
      });
    } else {
      // Admin de empresa e usuários normais veem apenas treinamentos ativos
      trainings = await prisma.training.findMany({
        where: { isActive: true },
        ...includeOpts,
      });
    }

    const trainingIds = trainings.map((training) => training.id);
    const userId = req.auth.userId;

    let progressByTraining = {};
    if (userId && trainingIds.length > 0) {
      const [progressRows, certificateRows, attemptRows] = await Promise.all([
        prisma.userTrainingProgress.findMany({
          where: {
            userId,
            trainingId: { in: trainingIds },
          },
        }),
        prisma.certificate.findMany({
          where: {
            userId,
            trainingId: { in: trainingIds },
          },
        }),
        prisma.quizAttempt.findMany({
          where: {
            userId,
            quiz: {
              trainingId: { in: trainingIds },
            },
          },
          include: {
            quiz: {
              select: {
                trainingId: true,
              },
            },
          },
          orderBy: { completedAt: "desc" },
        }),
      ]);

      const certificateMap = new Map(
        certificateRows.map((certificate) => [certificate.trainingId, certificate])
      );

      const latestAttemptByTraining = new Map();
      for (const attempt of attemptRows) {
        const trId = attempt.quiz.trainingId;
        if (!latestAttemptByTraining.has(trId)) {
          latestAttemptByTraining.set(trId, attempt);
        }
      }

      progressByTraining = progressRows.reduce((acc, row) => {
        const latestAttempt = latestAttemptByTraining.get(row.trainingId) ?? null;
        const certificate = certificateMap.get(row.trainingId) ?? null;

        acc[row.trainingId] = {
          status: row.status,
          videoWatched: row.videoWatched,
          quizCompleted: row.quizCompleted,
          certificateGenerated: row.certificateGenerated,
          lastAttempt: latestAttempt
            ? {
                attemptId: latestAttempt.id,
                score: latestAttempt.score,
                passed: latestAttempt.passed,
                completedAt: latestAttempt.completedAt,
              }
            : null,
          certificate: certificate
            ? {
                id: certificate.id,
                url: certificate.certificateUrl,
                issuedAt: certificate.issuedAt,
              }
            : null,
        };

        return acc;
      }, {});
    }

    const result = trainings.map((training) => {
      const { quizzes, ...rest } = training;
      return {
        ...rest,
        userProgress: progressByTraining[training.id] ?? null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch trainings", error);
    res.status(500).json({ message: "Failed to fetch trainings" });
  }
});

app.post("/trainings", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { title, description, videoUrl } = req.body;

    if (!title || !description || !videoUrl) {
      return res.status(400).json({ 
        message: "Título, descrição e URL do vídeo são obrigatórios" 
      });
    }

    const training = await prisma.training.create({
      data: {
        title,
        description,
        videoUrl,
        isActive: true,
      },
    });

    res.status(201).json(training);
  } catch (error) {
    console.error("Failed to create training", error);
    res.status(500).json({ message: "Failed to create training" });
  }
});

app.put("/trainings/:id", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, isActive } = req.body;

    const training = await prisma.training.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(videoUrl && { videoUrl }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
    });

    res.json(training);
  } catch (error) {
    console.error("Failed to update training", error);
    res.status(500).json({ message: "Failed to update training" });
  }
});

app.delete("/trainings/:id", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.training.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete training", error);
    res.status(500).json({ message: "Failed to delete training" });
  }
});

// Utilitário para validar estrutura de questões
function validateQuizPayload(body) {
  if (!body || typeof body !== "object") {
    return "Dados do quiz inválidos.";
  }

  const { title, questions, passingScore, timeLimit, isActive } = body;

  if (!title || typeof title !== "string") {
    return "Título do quiz é obrigatório.";
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return "Informe pelo menos uma questão.";
  }

  for (const [index, question] of questions.entries()) {
    if (!question || typeof question !== "object") {
      return `Questão ${index + 1} inválida.`;
    }

    if (!question.prompt || typeof question.prompt !== "string") {
      return `Questão ${index + 1}: texto é obrigatório.`;
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      return `Questão ${index + 1}: forneça ao menos duas alternativas.`;
    }

    if (typeof question.correctOptionIndex !== "number" || question.correctOptionIndex < 0 || question.correctOptionIndex >= question.options.length) {
      return `Questão ${index + 1}: índice de resposta correta inválido.`;
    }
  }

  if (passingScore !== undefined) {
    const numericScore = Number(passingScore);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      return "Nota mínima deve estar entre 0 e 100.";
    }
  }

  if (timeLimit !== undefined) {
    const numericLimit = Number(timeLimit);
    if (Number.isNaN(numericLimit) || numericLimit < 1 || numericLimit > 600) {
      return "Tempo limite deve estar entre 1 e 600 minutos.";
    }
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return "Campo isActive deve ser verdadeiro ou falso.";
  }

  return null;
}

app.get("/trainings/:trainingId/quizzes", authenticate, async (req, res) => {
  try {
    const { trainingId } = req.params;
    const includeInactive = req.auth.role === "ADMIN_GLOBAL";

    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) {
      return res.status(404).json({ message: "Treinamento não encontrado" });
    }

    if (!training.isActive && req.auth.role !== "ADMIN_GLOBAL") {
      return res.status(403).json({ message: "Treinamento inativo" });
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        trainingId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(quizzes);
  } catch (error) {
    console.error("Failed to fetch quizzes", error);
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
});

app.post("/trainings/:trainingId/quizzes", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { trainingId } = req.params;
    const training = await prisma.training.findUnique({ where: { id: trainingId } });
    if (!training) {
      return res.status(404).json({ message: "Treinamento não encontrado" });
    }

    const validationError = validateQuizPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const quiz = await prisma.quiz.create({
      data: {
        trainingId,
        title: req.body.title.trim(),
        questions: req.body.questions,
        passingScore: Number(req.body.passingScore ?? 70),
        timeLimit: req.body.timeLimit !== undefined ? Number(req.body.timeLimit) : null,
        isActive: req.body.isActive ?? true,
      },
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error("Failed to create quiz", error);
    res.status(500).json({ message: "Failed to create quiz" });
  }
});

app.put("/quizzes/:quizId", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { quizId } = req.params;
    const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      return res.status(404).json({ message: "Quiz não encontrado" });
    }

    if (req.body.questions !== undefined) {
      const validationError = validateQuizPayload({
        title: req.body.title ?? existing.title,
        questions: req.body.questions,
        passingScore: req.body.passingScore ?? existing.passingScore,
        timeLimit: req.body.timeLimit ?? existing.timeLimit,
        isActive: req.body.isActive ?? existing.isActive,
      });
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
    }

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(req.body.title && { title: req.body.title.trim() }),
        ...(req.body.questions && { questions: req.body.questions }),
        ...(req.body.passingScore !== undefined && { passingScore: Number(req.body.passingScore) }),
        ...(req.body.timeLimit !== undefined && { timeLimit: req.body.timeLimit !== null ? Number(req.body.timeLimit) : null }),
        ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
      },
    });

    res.json(quiz);
  } catch (error) {
    console.error("Failed to update quiz", error);
    res.status(500).json({ message: "Failed to update quiz" });
  }
});

app.delete("/quizzes/:quizId", authenticate, requireTrainingManager, async (req, res) => {
  try {
    const { quizId } = req.params;
    await prisma.quiz.delete({ where: { id: quizId } });
    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete quiz", error);
    res.status(500).json({ message: "Failed to delete quiz" });
  }
});

function calculateQuizScore(quiz, answers) {
  const totalQuestions = quiz.questions.length;
  if (!Array.isArray(answers) || answers.length !== totalQuestions) {
    throw new Error("Número de respostas inválido.");
  }

  let correct = 0;
  quiz.questions.forEach((question, index) => {
    if (answers[index] === question.correctOptionIndex) {
      correct += 1;
    }
  });

  const score = Math.round((correct / totalQuestions) * 100);
  const passed = score >= quiz.passingScore;

  return { score, correct, totalQuestions, passed };
}

function resolveFrontendBaseUrl() {
  const candidates = [
    process.env.CERTIFICATE_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.APP_BASE_URL,
    process.env.PUBLIC_FRONTEND_URL,
  ];

  const base = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  const fallback = "https://ativa-nr1.vercel.app";

  return (base ?? fallback).replace(/\/$/, "");
}

function buildCertificateUrl({ quizId, trainingId, userId }) {
  const baseUrl = resolveFrontendBaseUrl();
  return `${baseUrl}/certificados/${trainingId}/${quizId}/${userId}`;
}

app.post("/quizzes/:quizId/attempts", authenticate, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        training: true,
      },
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz não encontrado" });
    }

    if (!quiz.isActive || !quiz.training.isActive) {
      return res.status(403).json({ message: "Quiz inativo" });
    }

    const validationResult = calculateQuizScore(quiz, answers);

    const attempt = await prisma.$transaction(async (tx) => {
      const newAttempt = await tx.quizAttempt.create({
        data: {
          quizId: quiz.id,
          userId: req.auth.userId,
          answers,
          score: validationResult.score,
          passed: validationResult.passed,
        },
      });

      let certificate = null;

      if (validationResult.passed) {
        certificate = await tx.certificate.upsert({
          where: {
            userId_trainingId: {
              userId: req.auth.userId,
              trainingId: quiz.trainingId,
            },
          },
          update: {
            quizId: quiz.id,
            certificateUrl: buildCertificateUrl({
              quizId: quiz.id,
              trainingId: quiz.trainingId,
              userId: req.auth.userId,
            }),
            issuedAt: new Date(),
          },
          create: {
            trainingId: quiz.trainingId,
            quizId: quiz.id,
            userId: req.auth.userId,
            certificateUrl: buildCertificateUrl({
              quizId: quiz.id,
              trainingId: quiz.trainingId,
              userId: req.auth.userId,
            }),
          },
        });

        await tx.userTrainingProgress.upsert({
          where: {
            userId_trainingId: {
              userId: req.auth.userId,
              trainingId: quiz.trainingId,
            },
          },
          update: {
            quizCompleted: true,
            certificateGenerated: true,
            status: "completed",
            completedAt: new Date(),
          },
          create: {
            userId: req.auth.userId,
            trainingId: quiz.trainingId,
            status: "completed",
            videoWatched: true,
            quizCompleted: true,
            certificateGenerated: true,
            completedAt: new Date(),
          },
        });

        return { newAttempt, certificate };
      }

      await tx.userTrainingProgress.upsert({
        where: {
          userId_trainingId: {
            userId: req.auth.userId,
            trainingId: quiz.trainingId,
          },
        },
        update: {
          quizCompleted: false,
          certificateGenerated: false,
          status: "in_progress",
        },
        create: {
          userId: req.auth.userId,
          trainingId: quiz.trainingId,
          status: "in_progress",
          videoWatched: true,
        },
      });

      return { newAttempt, certificate: null };
    });

    res.status(201).json({
      attempt: {
        id: attempt.newAttempt.id,
        score: validationResult.score,
        passed: validationResult.passed,
        correct: validationResult.correct,
        totalQuestions: validationResult.totalQuestions,
        completedAt: attempt.newAttempt.completedAt,
      },
      certificate: attempt.certificate,
    });
  } catch (error) {
    console.error("Failed to submit quiz attempt", error);
    const message = error instanceof Error ? error.message : "Failed to submit quiz attempt";
    res.status(400).json({ message });
  }
});

app.get("/certificates/:certificateId/download", authenticate, async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: true,
        training: true,
        quiz: true,
      },
    });

    if (!certificate) {
      return res.status(404).json({ message: "Certificado não encontrado" });
    }

    const company = certificate.user.companyId
      ? await prisma.company.findUnique({ where: { id: certificate.user.companyId } })
      : null;

    const isAdminGlobal = req.auth.role === UserRole.ADMIN_GLOBAL;
    const isSameUser = certificate.userId === req.auth.userId;
    const isSameCompany = company && req.auth.companyId && company.id === req.auth.companyId;

    if (!isAdminGlobal && !isSameUser && !isSameCompany) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId: certificate.quizId,
        userId: certificate.userId,
        passed: true,
      },
      orderBy: { completedAt: "desc" },
    });

    if (!attempt) {
      return res.status(404).json({ message: "Tentativa aprovada não encontrada" });
    }

    const doc = createCertificatePdf({
      user: certificate.user,
      training: certificate.training,
      quiz: certificate.quiz,
      attempt: {
        score: attempt.score,
        totalQuestions: Array.isArray(attempt.answers) ? attempt.answers.length : certificate.quiz.questions.length,
        completedAt: attempt.completedAt,
      },
      company,
    });

    const sanitizedStudent = certificate.user.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const sanitizedTraining = certificate.training.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const filename = `certificado-${sanitizedStudent}-${sanitizedTraining}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    const passThrough = new stream.PassThrough();
    doc.pipe(passThrough);
    passThrough.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Failed to generate certificate PDF", error);
    res.status(500).json({ message: "Erro ao gerar certificado" });
  }
});

app.get("/certificates/:certificateId/download", authenticate, async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: true,
        training: true,
        quiz: true,
      },
    });

    if (!certificate) {
      return res.status(404).json({ message: "Certificado não encontrado" });
    }

    if (
      req.auth.role !== UserRole.ADMIN_GLOBAL &&
      certificate.userId !== req.auth.userId &&
      (!req.auth.companyId || certificate.user.companyId !== req.auth.companyId)
    ) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    let lastAttempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId: certificate.quizId,
        userId: certificate.userId,
        passed: true,
      },
      orderBy: { completedAt: "desc" },
    });

    if (!lastAttempt) {
      return res.status(404).json({ message: "Tentativa aprovada não encontrada" });
    }

    const doc = createCertificatePdf({
      user: certificate.user,
      training: certificate.training,
      quiz: certificate.quiz,
      attempt: {
        score: lastAttempt.score,
        totalQuestions: Array.isArray(lastAttempt.answers) ? lastAttempt.answers.length : certificate.quiz.questions.length,
        completedAt: lastAttempt.completedAt,
      },
      company: certificate.user.companyId
        ? await prisma.company.findUnique({ where: { id: certificate.user.companyId } })
        : null,
    });

    const filename = `certificado-${certificate.user.name.replace(/\s+/g, "-").toLowerCase()}-${certificate.training.title.replace(/\s+/g, "-").toLowerCase()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Failed to generate certificate PDF", error);
    res.status(500).json({ message: "Erro ao gerar certificado" });
  }
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Cloud API running on http://localhost:${PORT}`);
  /* eslint-enable no-console */
});

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error during Prisma disconnect", error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
