import "dotenv/config";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole, Prisma } from "@prisma/client";
import { generateCompanyInsights, isAiConfigured } from "./services/aiSuggestions.js";
import { sendWelcomeEmail, sendPasswordResetEmail, isEmailConfigured } from "./services/emailService.js";

const prisma = new PrismaClient();
const DEFAULT_QUESTIONNAIRE = "default";
const MAX_SYNC_HISTORY = 50;
const PASSWORD_SALT_ROUNDS = Number(process.env.AUTH_SALT_ROUNDS ?? 10);
const MIN_PASSWORD_LENGTH = Number(process.env.AUTH_MIN_PASSWORD_LENGTH ?? 8);
const DEFAULT_AI_LIMIT = Number(process.env.AI_SUGGESTION_LIMIT ?? 5);

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET não definido; usando fallback inseguro apenas para desenvolvimento.");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "12h";
const AUTH_HEADER_PREFIX = "Bearer ";

function signToken({ id, role, companyId }) {
  return jwt.sign(
    { sub: id, role, companyId: companyId ?? null },
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
    return next();
  } catch (error) {
    console.warn("Token inválido", error);
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
  withCompany(async (_req, res, companyId) => {
    try {
      const [responseRows, syncRows, planRows] = await Promise.all([
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

      res.json({ responses, syncHistory, actionPlans });
    } catch (error) {
      console.error("Failed to fetch state", error);
      res.status(500).json({ message: "Failed to fetch state" });
    }
  })
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
    const { responses = {}, syncHistory = [], actionPlans = [] } = req.body ?? {};

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
      });

      res.status(204).end();
    } catch (error) {
      console.error("Failed to persist state", error);
      res.status(500).json({ message: "Failed to persist state" });
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
