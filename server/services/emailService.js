import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.locaweb.com.br";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "cadastro@infratechnologia.com.br";
const SMTP_PASS = process.env.SMTP_PASS || "Mudar@1234";
const SMTP_FROM = process.env.SMTP_FROM || "NR-1 Compliance <cadastro@infratechnologia.com.br>";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const port = SMTP_PORT;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: port,
      secure: port === 465, // true para 465, false para outras portas
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000, // 10 segundos
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return transporter;
}

export async function sendWelcomeEmail({ to, name, login, companyCode, companyName, isNewCompany }) {
  const subject = isNewCompany 
    ? "Bem-vindo ao NR-1 Compliance - Empresa cadastrada com sucesso"
    : "Bem-vindo ao NR-1 Compliance - Usuário criado com sucesso";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao NR-1 Compliance</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">NR-1 Compliance</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px; letter-spacing: 2px;">ATIVA</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">
                ${isNewCompany ? 'Empresa cadastrada com sucesso!' : 'Usuário criado com sucesso!'}
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Olá <strong>${name}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                ${isNewCompany 
                  ? 'Sua empresa foi cadastrada com sucesso na plataforma NR-1 Compliance. Abaixo estão suas credenciais de acesso:'
                  : 'Seu usuário foi criado com sucesso na plataforma NR-1 Compliance. Abaixo estão suas credenciais de acesso:'
                }
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 25px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Empresa</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 15px 0;">
                          <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${companyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Código da Empresa</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 15px 0;">
                          <span style="color: #1e40af; font-size: 18px; font-weight: 700; font-family: monospace;">${companyCode}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Login</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 15px 0;">
                          <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${login}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">E-mail</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0;">
                          <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${to}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                <strong>Importante:</strong> Guarde o código da empresa em local seguro. Ele será necessário para todos os acessos à plataforma.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://ativa-nr1.vercel.app/login" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Acessar Plataforma
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Se você tiver dúvidas ou precisar de suporte, entre em contato conosco através do e-mail 
                <a href="mailto:cadastro@infratechnologia.com.br" style="color: #1e40af; text-decoration: none;">cadastro@infratechnologia.com.br</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px;">
                © ${new Date().getFullYear()} NR-1 Compliance - Ativa. Todos os direitos reservados.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                Este é um e-mail automático. Por favor, não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
NR-1 Compliance - Ativa

${isNewCompany ? 'Empresa cadastrada com sucesso!' : 'Usuário criado com sucesso!'}

Olá ${name},

${isNewCompany 
  ? 'Sua empresa foi cadastrada com sucesso na plataforma NR-1 Compliance.'
  : 'Seu usuário foi criado com sucesso na plataforma NR-1 Compliance.'
}

Suas credenciais de acesso:

Empresa: ${companyName}
Código da Empresa: ${companyCode}
Login: ${login}
E-mail: ${to}

IMPORTANTE: Guarde o código da empresa em local seguro. Ele será necessário para todos os acessos à plataforma.

Acesse a plataforma em: https://ativa-nr1.vercel.app/login

Se você tiver dúvidas ou precisar de suporte, entre em contato conosco através do e-mail cadastro@infratechnologia.com.br

---
© ${new Date().getFullYear()} NR-1 Compliance - Ativa. Todos os direitos reservados.
Este é um e-mail automático. Por favor, não responda.
  `;

  try {
    const info = await getTransporter().sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    console.log("Email enviado com sucesso:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    throw new Error(`Falha ao enviar email: ${error.message}`);
  }
}

export function isEmailConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS);
}
