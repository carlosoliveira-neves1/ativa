import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listAdmins() {
  try {
    console.log("=== Usuários Admin Global ===\n");

    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN_GLOBAL",
      },
      select: {
        id: true,
        name: true,
        email: true,
        login: true,
        role: true,
        createdAt: true,
      },
    });

    if (admins.length === 0) {
      console.log("❌ Nenhum Admin Global encontrado!\n");
      console.log("💡 Execute o script create-admin.js para criar um:");
      console.log("   npm run create-admin\n");
    } else {
      console.log(`✅ Encontrados ${admins.length} Admin(s) Global:\n`);
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Login: ${admin.login}`);
        console.log(`   Criado em: ${admin.createdAt.toLocaleString("pt-BR")}`);
        console.log("");
      });
    }

    console.log("=== Todos os usuários ===\n");

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        login: true,
        role: true,
        company: {
          select: {
            nomeFantasia: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`Total de usuários: ${allUsers.length}\n`);
    allUsers.forEach((user, index) => {
      const roleLabel = user.role === "ADMIN_GLOBAL" ? "🔴 Admin Global" : "🔵 Admin Empresa";
      console.log(`${index + 1}. ${user.name} (${roleLabel})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Login: ${user.login}`);
      if (user.company) {
        console.log(`   Empresa: ${user.company.nomeFantasia} (${user.company.code})`);
      }
      console.log("");
    });
  } catch (error) {
    console.error("❌ Erro ao listar usuários:", error);
  } finally {
    await prisma.$disconnect();
  }
}

listAdmins();
