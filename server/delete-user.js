import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteUser() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("=== Deletar Usuário/Empresa ===\n");
    console.log("Uso:");
    console.log("  npm run delete:user -- --email <email>");
    console.log("  npm run delete:user -- --login <login>");
    console.log("  npm run delete:user -- --cnpj <cnpj>");
    console.log("  npm run delete:user -- --company-code <codigo>");
    console.log("\nExemplos:");
    console.log("  npm run delete:user -- --email carlos@email.com");
    console.log("  npm run delete:user -- --login carlos123");
    console.log("  npm run delete:user -- --cnpj 61696529000186");
    console.log("  npm run delete:user -- --company-code ATV-0186");
    process.exit(1);
  }

  const option = args[0];
  const value = args[1];

  if (!value) {
    console.error("❌ Erro: Valor não fornecido");
    process.exit(1);
  }

  try {
    let user = null;
    let company = null;

    switch (option) {
      case "--email":
        user = await prisma.user.findUnique({
          where: { email: value },
          include: { company: true },
        });
        break;

      case "--login":
        user = await prisma.user.findUnique({
          where: { login: value },
          include: { company: true },
        });
        break;

      case "--cnpj":
        const cnpjClean = value.replace(/\D/g, "");
        company = await prisma.company.findUnique({
          where: { cnpj: cnpjClean },
          include: { users: true },
        });
        break;

      case "--company-code":
        company = await prisma.company.findUnique({
          where: { code: value.toUpperCase() },
          include: { users: true },
        });
        break;

      default:
        console.error("❌ Opção inválida:", option);
        process.exit(1);
    }

    if (user) {
      console.log("\n📋 Usuário encontrado:");
      console.log("- ID:", user.id);
      console.log("- Nome:", user.name);
      console.log("- Login:", user.login);
      console.log("- Email:", user.email);
      console.log("- Role:", user.role);
      if (user.company) {
        console.log("- Empresa:", user.company.nomeFantasia, `(${user.company.code})`);
      }

      console.log("\n⚠️  Deletando usuário...");
      await prisma.user.delete({ where: { id: user.id } });
      console.log("✅ Usuário deletado com sucesso!");

    } else if (company) {
      console.log("\n📋 Empresa encontrada:");
      console.log("- ID:", company.id);
      console.log("- Código:", company.code);
      console.log("- Nome Fantasia:", company.nomeFantasia);
      console.log("- Razão Social:", company.razaoSocial);
      console.log("- CNPJ:", company.cnpj);
      console.log("- Usuários:", company.users.length);

      if (company.users.length > 0) {
        console.log("\n👥 Usuários da empresa:");
        company.users.forEach((u, i) => {
          console.log(`  ${i + 1}. ${u.name} (${u.login}) - ${u.role}`);
        });
      }

      console.log("\n⚠️  Deletando empresa e todos os usuários...");
      
      // Deletar em ordem (relacionamentos)
      await prisma.companyInsight.deleteMany({ where: { companyId: company.id } });
      await prisma.actionPlan.deleteMany({ where: { companyId: company.id } });
      await prisma.syncEntry.deleteMany({ where: { companyId: company.id } });
      await prisma.questionResponse.deleteMany({ where: { companyId: company.id } });
      await prisma.user.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });

      console.log("✅ Empresa e todos os dados relacionados deletados com sucesso!");

    } else {
      console.log("❌ Nenhum registro encontrado com:", option, "=", value);
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Erro ao deletar:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();
