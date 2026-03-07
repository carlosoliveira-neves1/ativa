import nodemailer from "nodemailer";

// Configurações SMTP - Locaweb SMTP dedicado
const SMTP_HOST = process.env.SMTP_HOST || "smtplw.com.br";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "cadastro@infratechnologia.com.br";
const SMTP_PASS = process.env.SMTP_PASS || "Mudar@1234";
const SMTP_FROM = process.env.SMTP_FROM || "NR-1 Compliance <cadastro@infratechnologia.com.br>";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const port = SMTP_PORT;
    const isSecure = port === 465;
    
    console.log("Configurando transporter SMTP:", {
      host: SMTP_HOST,
      port: port,
      secure: isSecure,
      user: SMTP_USER,
    });

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: port,
      secure: isSecure, // true para 465 (SSL), false para 587 (TLS)
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 30000, // 30 segundos
      greetingTimeout: 30000,
      socketTimeout: 30000,
      logger: false, // Desabilitar logs detalhados em produção
      debug: false, // Desabilitar debug em produção
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
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Formulário de Análise Psicossocial FAP</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px; letter-spacing: 2px;">NR1</p>
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
                  ? 'Sua empresa foi cadastrada com sucesso na plataforma Formulário de Análise Psicossocial FAP. Abaixo estão suas credenciais de acesso:'
                  : 'Seu usuário foi criado com sucesso na plataforma Formulário de Análise Psicossocial FAP. Abaixo estão suas credenciais de acesso:'
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

export async function sendPasswordResetEmail({ to, name, resetToken }) {
  const resetUrl = `https://ativa-nr1.vercel.app/reset-password?token=${resetToken}`;
  const subject = "Recuperação de Senha - NR-1 Compliance";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">NR-1 Compliance</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px; letter-spacing: 2px;">ATIVA</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">
                Recuperação de Senha
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Olá <strong>${name}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta. Se você não fez essa solicitação, ignore este e-mail.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Para criar uma nova senha, clique no botão abaixo:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Ou copie e cole este link no seu navegador:
              </p>
              
              <p style="margin: 0 0 30px 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px; word-break: break-all; font-size: 13px; color: #475569;">
                ${resetUrl}
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 30px 0;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                      <strong>⚠️ Importante:</strong> Este link expira em <strong>1 hora</strong>. Se expirar, solicite uma nova recuperação de senha.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Se você tiver dúvidas ou não solicitou esta recuperação, entre em contato conosco através do e-mail 
                <a href="mailto:cadastro@infratechnologia.com.br" style="color: #1e40af; text-decoration: none;">cadastro@infratechnologia.com.br</a>
              </p>
            </td>
          </tr>
          
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

Recuperação de Senha

Olá ${name},

Recebemos uma solicitação para redefinir a senha da sua conta. Se você não fez essa solicitação, ignore este e-mail.

Para criar uma nova senha, acesse o link abaixo:
${resetUrl}

IMPORTANTE: Este link expira em 1 hora. Se expirar, solicite uma nova recuperação de senha.

Se você tiver dúvidas ou não solicitou esta recuperação, entre em contato conosco através do e-mail cadastro@infratechnologia.com.br

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

    console.log("Email de recuperação enviado com sucesso:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erro ao enviar email de recuperação:", error);
    throw new Error(`Falha ao enviar email: ${error.message}`);
  }
}

export async function sendQuestionnaireInvitationEmail({ to, name, companyCode, companyName, questionnaireToken, questionnaireName }) {
  const subject = `Convite para preencher Questionário ${questionnaireName} - ${companyName}`;
  
  const questionnaireLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/questionnaire/token/${questionnaireToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .button { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .info-box { background: #f8fafc; border-left: 4px solid #1e40af; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Convite para Questionário NR-1</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          <p>Você foi convidado(a) a preencher o questionário <strong>${questionnaireName}</strong> para a empresa <strong>${companyName}</strong>.</p>
          
          <div class="info-box">
            <p><strong>Dados da Empresa:</strong></p>
            <p>Código: <strong>${companyCode}</strong></p>
            <p>Empresa: <strong>${companyName}</strong></p>
          </div>
          
          <p>Para acessar o questionário, clique no botão abaixo ou use o link fornecido:</p>
          
          <div style="text-align: center;">
            <a href="${questionnaireLink}" class="button">Acessar Questionário</a>
          </div>
          
          <p>Ou copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 5px;">
            ${questionnaireLink}
          </p>
          
          <p><strong>Importante:</strong></p>
          <ul>
            <li>O link é pessoal e intransferível</li>
            <li>Não é necessário criar senha ou fazer login</li>
            <li>Seu progresso será salvo automaticamente</li>
            <li>Você pode retornar e continuar a qualquer momento</li>
          </ul>
          
          <p>Se você tiver alguma dúvida, entre em contato com o administrador do sistema.</p>
          
          <p>Atenciosamente,<br>Equipe NR-1 Compliance</p>
        </div>
        <div class="footer">
          <p>Este é um email automático. Por favor, não responda a este endereço.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });

    console.log("Email de convite de questionário enviado com sucesso:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erro ao enviar email de convite de questionário:", error);
    throw new Error(`Falha ao enviar email: ${error.message}`);
  }
}

export function isEmailConfigured() {
  return Boolean(SMTP_USER && SMTP_PASS);
}
