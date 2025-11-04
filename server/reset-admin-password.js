import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function resetAdminPassword() {
  try {
    console.log("=== Resetar Senha do Admin Global ===\n");

    // Listar admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN_GLOBAL" },
      select: {
        id: true,
        name: true,
        email: true,
        login: true,
      },
    });

    if (admins.length === 0) {
      console.log("❌ Nenhum Admin Global encontrado!");
      console.log("💡 Execute: npm run create-admin\n");
      rl.close();
      await prisma.$disconnect();
      return;
    }

    console.log("Admins disponíveis:\n");
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Login: ${admin.login}\n`);
    });

    const choice = await question("Escolha o número do admin (ou Enter para o primeiro): ");
    const selectedIndex = choice ? parseInt(choice) - 1 : 0;
    const selectedAdmin = admins[selectedIndex];

    if (!selectedAdmin) {
      console.log("❌ Opção inválida!");
      rl.close();
      await prisma.$disconnect();
      return;
    }

    console.log(`\n✅ Selecionado: ${selectedAdmin.name} (${selectedAdmin.email})`);

    const newPassword = await question("\nDigite a nova senha (mínimo 6 caracteres): ");

    if (!newPassword || newPassword.length < 6) {
      console.log("❌ Senha deve ter no mínimo 6 caracteres!");
      rl.close();
      await prisma.$disconnect();
      return;
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { id: selectedAdmin.id },
      data: { passwordHash },
    });

    console.log("\n✅ Senha alterada com sucesso!\n");
    console.log("=== Credenciais de Login ===");
    console.log(`Login: ${selectedAdmin.login}`);
    console.log(`Email: ${selectedAdmin.email}`);
    console.log(`Senha: ${newPassword}`);
    console.log(`\n🔗 Acesse: https://ativa-nr1.vercel.app/login\n`);
  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

resetAdminPassword();
