import "dotenv/config";
import { sendWelcomeEmail, isEmailConfigured } from "./services/emailService.js";

async function testEmail() {
  console.log("=== Teste de Envio de Email ===\n");
  
  // Verificar configuração
  console.log("Configurações SMTP:");
  console.log("- Host:", process.env.SMTP_HOST || "smtp.locaweb.com.br");
  console.log("- Port:", process.env.SMTP_PORT || "465");
  console.log("- User:", process.env.SMTP_USER || "cadastro@infratechnologia.com.br");
  console.log("- From:", process.env.SMTP_FROM || "NR-1 Compliance <cadastro@infratechnologia.com.br>");
  console.log("- Configurado:", isEmailConfigured() ? "✅ Sim" : "❌ Não");
  console.log("");

  if (!isEmailConfigured()) {
    console.error("❌ Email não configurado. Verifique as variáveis de ambiente.");
    process.exit(1);
  }

  // Dados de teste
  const testData = {
    to: process.env.TEST_EMAIL || "carlos.oliveiraneves1@gmail.com",
    name: "Usuário Teste",
    login: "teste123",
    companyCode: "ATV-0001",
    companyName: "Empresa Teste LTDA",
    isNewCompany: true,
  };

  console.log("Enviando email de teste para:", testData.to);
  console.log("Aguarde...\n");

  try {
    const result = await sendWelcomeEmail(testData);
    console.log("✅ Email enviado com sucesso!");
    console.log("Message ID:", result.messageId);
    console.log("\nVerifique a caixa de entrada (e spam) de:", testData.to);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao enviar email:");
    console.error("Mensagem:", error.message);
    console.error("Código:", error.code);
    console.error("\nDetalhes completos:");
    console.error(error);
    process.exit(1);
  }
}

testEmail();
