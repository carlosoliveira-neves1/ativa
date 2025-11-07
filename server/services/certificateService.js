import PDFDocument from "pdfkit";

/**
 * Generates a certificate PDF stream. Caller is responsible for piping and ending the document.
 * @param {{ user: { name: string, email?: string }, training: { title: string }, quiz: { title: string }, attempt: { score: number, totalQuestions: number, completedAt: Date }, company?: { nomeFantasia?: string }}} params
 * @returns {PDFKit.PDFDocument}
 */
export function createCertificatePdf({ user, training, quiz, attempt, company }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.info = {
    Title: "Certificado de Conclusão",
    Author: company?.nomeFantasia ?? "Ativa Treinamentos",
    Subject: training.title,
    Creator: "Plataforma NR-1 Ativa",
  };

  doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke("#0f172a");

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor("#0f172a")
    .text("Certificado de Conclusão", {
      align: "center",
      underline: false,
    })
    .moveDown(1.5);

  if (company?.nomeFantasia) {
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#334155")
      .text(`Emitido por: ${company.nomeFantasia}`, { align: "center" })
      .moveDown(1.5);
  }

  doc
    .font("Helvetica")
    .fontSize(16)
    .fillColor("black")
    .text(
      `Certificamos que ${user.name} participou e concluiu o treinamento "${training.title}" com aprovação na avaliação "${quiz.title}".`,
      {
        align: "center",
        lineGap: 6,
      }
    )
    .moveDown(1.5);

  doc
    .fontSize(14)
    .text(`Aproveitamento: ${attempt.score}/${attempt.totalQuestions} questões corretas.`, {
      align: "center",
    })
    .moveDown(1.5);

  const completionDate = new Date(attempt.completedAt);
  doc
    .fontSize(12)
    .text(
      `Data de conclusão: ${completionDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}`,
      {
        align: "center",
      }
    )
    .moveDown(3);

  doc
    .moveDown(3)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("______________________________", { align: "center" })
    .text(company?.nomeFantasia ?? "Ativa Treinamentos", { align: "center" })
    .moveDown(1);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#64748b")
    .text("Documento gerado eletronicamente via plataforma NR-1 Ativa.", {
      align: "center",
    })
    .moveDown(1)
    .text(`Contato: ${user.email ?? "suporte@ativa.com"}`, { align: "center" });

  return doc;
}
