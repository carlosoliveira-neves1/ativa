import "dotenv/config";

const API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL = process.env.HUGGINGFACE_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
const ENDPOINT = process.env.HUGGINGFACE_ENDPOINT || `https://router.huggingface.co/hf-inference/models/${MODEL}`;

console.log("=== Teste de Conexão Hugging Face ===\n");

// Verificar configuração
console.log("📋 Configuração:");
console.log("- API Key:", API_KEY ? `✅ Configurada (${API_KEY.substring(0, 10)}...)` : "❌ Não configurada");
console.log("- Modelo:", MODEL);
console.log("- Endpoint:", ENDPOINT);
console.log("");

if (!API_KEY) {
  console.error("❌ ERRO: HUGGINGFACE_API_KEY não configurada!");
  console.log("\nConfigure no Render:");
  console.log("HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  process.exit(1);
}

// Testar conexão
console.log("🔄 Testando conexão com Hugging Face...\n");

const testPrompt = "Olá! Você está funcionando?";

async function testConnection() {
  try {
    console.log("📤 Enviando requisição...");
    
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        inputs: testPrompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.7,
          return_full_text: false,
        },
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
      console.log("2. Tente outro modelo: HUGGINGFACE_MODEL=google/flan-t5-large");
      console.log("3. Aguarde alguns minutos (modelo pode estar carregando)");
      process.exit(1);
    }

    const data = await response.json();
    console.log("✅ SUCESSO! Conexão funcionando!");
    console.log("\n📊 Resposta da IA:");
    
    if (Array.isArray(data)) {
      const text = data[0]?.generated_text || data[0]?.text || data[0]?.content || JSON.stringify(data[0]);
      console.log(text);
    } else {
      const text = data.generated_text || data.text || data.content || JSON.stringify(data);
      console.log(text);
    }

    console.log("\n🎉 Tudo pronto! A IA está funcionando corretamente.");
    console.log("\n📝 Próximos passos:");
    console.log("1. Acesse o app: https://ativa-nr1.vercel.app");
    console.log("2. Faça login");
    console.log("3. Clique em 'Gerar Recomendações' no Dashboard");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO ao conectar:");
    console.error("Mensagem:", error.message);
    console.error("\nDetalhes completos:");
    console.error(error);
    
    console.log("\n💡 Possíveis causas:");
    console.log("1. Problema de rede");
    console.log("2. Endpoint incorreto");
    console.log("3. API Key inválida");
    
    process.exit(1);
  }
}

testConnection();
