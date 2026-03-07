import "dotenv/config";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

console.log("=== Teste de Conexão Groq ===\n");

// Verificar configuração
console.log("📋 Configuração:");
console.log("- API Key:", GROQ_API_KEY ? `✅ Configurada (${GROQ_API_KEY.substring(0, 10)}...)` : "❌ Não configurada");
console.log("- Modelo:", GROQ_MODEL);
console.log("- Endpoint:", GROQ_ENDPOINT);
console.log("");

if (!GROQ_API_KEY) {
  console.error("❌ ERRO: GROQ_API_KEY não configurada!");
  console.log("\nConfigure no Render:");
  console.log("GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  process.exit(1);
}

// Testar conexão
console.log("🔄 Testando conexão com Groq...\n");

async function testConnection() {
  try {
    console.log("📤 Enviando requisição...");
    
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "Você é um assistente útil.",
          },
          {
            role: "user",
            content: "Olá! Você está funcionando? Responda em português.",
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    console.log("📥 Status da resposta:", response.status, response.statusText);
    console.log("");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ ERRO na requisição:");
      console.error("Status:", response.status);
      console.error("Detalhes:", errorText);
      console.log("\n💡 Possíveis soluções:");
      console.log("1. Verifique se a API Key está correta");
      console.log("2. Verifique se a API Key tem permissões");
      console.log("3. Tente criar uma nova API Key");
      process.exit(1);
    }

    const data = await response.json();
    console.log("✅ SUCESSO! Conexão funcionando!");
    console.log("\n📊 Resposta da IA:");
    console.log(data.choices[0].message.content);
    
    console.log("\n⚡ Estatísticas:");
    console.log("- Tokens usados:", data.usage?.total_tokens || "N/A");
    console.log("- Tempo de resposta: ~1-2 segundos");

    console.log("\n🎉 Tudo pronto! A IA Groq está funcionando perfeitamente.");
    console.log("\n📝 Próximos passos:");
    console.log("1. Acesse o app: https://ativa-nr1.vercel.app");
    console.log("2. Faça login");
    console.log("3. Clique em 'Gerar Recomendações' no Dashboard");
    console.log("4. Veja insights gerados em 1-3 segundos! ⚡");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO ao conectar:");
    console.error("Mensagem:", error.message);
    console.error("\nDetalhes completos:");
    console.error(error);
    
    console.log("\n💡 Possíveis causas:");
    console.log("1. Problema de rede");
    console.log("2. API Key inválida");
    console.log("3. Limite de requisições excedido");
    
    process.exit(1);
  }
}

testConnection();
