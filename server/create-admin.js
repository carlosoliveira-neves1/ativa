import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD_SALT_ROUNDS = 10;

async function createAdmin() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log("=== Criar Admin Global ===\n");
    console.log("Uso:");
    console.log("  npm run create:admin -- <nome> <login> <email> <senha>\n");
    console.log("Exemplo:");
    console.log("  npm run create:admin -- \"Carlos Admin\" carlosadmin carlos@email.com senha123\n");
    console.log("⚠️  Admin Global pode:");
    console.log("  - Acessar todas as empresas");
    console.log("  - Visualizar todos os dados");
    console.log("  - Gerar relatórios globais");
    console.log("  - Buscar empresas por CNPJ/código");
    process.exit(1);
  }

  const [name, login, email, password] = args;

  console.log("\n=== Criando Admin Global ===\n");
  console.log("Nome:", name);
  console.log("Login:", login);
  console.log("Email:", email);
  console.log("Senha:", "*".repeat(password.length));
  console.log("");

  try {
    // Verificar se login já existe
    const existingLogin = await prisma.user.findUnique({
      where: { login },
    });

    if (existingLogin) {
      console.error("❌ Erro: Login já existe!");
      console.log("\nUsuário existente:");
      console.log("- Nome:", existingLogin.name);
      console.log("- Login:", existingLogin.login);
      console.log("- Role:", existingLogin.role);
      process.exit(1);
    }

    // Verificar se email já existe
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      console.error("❌ Erro: Email já existe!");
      console.log("\nUsuário existente:");
      console.log("- Nome:", existingEmail.name);
      console.log("- Email:", existingEmail.email);
      console.log("- Role:", existingEmail.role);
      process.exit(1);
    }

    // Hash da senha
    console.log("🔐 Gerando hash da senha...");
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    // Criar admin global
    console.log("👤 Criando usuário...");
    const admin = await prisma.user.create({
      data: {
        name,
        login,
        email,
        passwordHash,
        role: "ADMIN_GLOBAL",
        companyId: null, // Admin global não tem empresa
      },
    });

    console.log("\n✅ Admin Global criado com sucesso!\n");
    console.log("📋 Dados do Admin:");
    console.log("- ID:", admin.id);
    console.log("- Nome:", admin.name);
    console.log("- Login:", admin.login);
    console.log("- Email:", admin.email);
    console.log("- Role:", admin.role);
    console.log("\n🔑 Credenciais de acesso:");
    console.log("- Login:", admin.login);
    console.log("- Senha:", password);
    console.log("\n⚠️  IMPORTANTE: Guarde essas credenciais em local seguro!");
    console.log("\n🌐 Para fazer login:");
    console.log("1. Acesse: https://ativa-nr1.vercel.app/login");
    console.log("2. Código da empresa: (deixe em branco ou qualquer código)");
    console.log("3. Login:", admin.login);
    console.log("4. Senha:", password);

  } catch (error) {
    console.error("\n❌ Erro ao criar admin:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
