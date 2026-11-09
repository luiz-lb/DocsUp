import PDFDocument from 'pdfkit';
import * as assignmentModel from '../models/assignmentModel.js';
import { ACCEPTANCE_TERM } from '../constants/acceptanceTerm.js';
import { SUPPLIER_USER_ROLE_LABELS } from '../constants/supplierUsers.js';
import { DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';
import { ASSIGNMENT_STATUSES } from '../constants/laborRequest.js';
import { toBrDateTime } from '../utils/dates.js';

/**
 * PDF da declaração do fornecedor: dados do contrato, o que a empresa declarou (documentos da
 * empresa e quantidade de colaboradores por documento), o termo de aceite assinado e a
 * assinatura digital (quem, e-mail, papel, data e hora, IP, navegador e o código de
 * verificação, que também aparece no sistema). O mesmo PDF para o fornecedor e para a Everest.
 */

const C = {
    teal: '#004643',
    cream: '#faf0ca',
    creamText: '#fffae4',
    text: '#111827',
    muted: '#6b7280',
    border: '#d1d5db',
    soft: '#f6f7f6',
    success: '#1e7a34',
    danger: '#b42318',
};

const MARGIN = 50;

function pad2(n) {
    return String(n).padStart(2, '0');
}

function brDateTimeSeconds(value) {
    if (!value) return null;
    const date = new Date(value);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} às ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function statusText(assignment) {
    if (assignment.status === ASSIGNMENT_STATUSES.BLOCKED) return 'Bloqueada: a empresa declarou não ter documento exigido';
    if (assignment.status === ASSIGNMENT_STATUSES.ENDED) return 'Encerrada (convite reenviado ou fornecedor trocado)';
    return 'Ativa: o fornecedor envia os documentos';
}

/** Termo assinado (texto guardado na assinatura) ou o atual, para declarações antigas. */
function signedTerm(assignment) {
    if (assignment.term_text) {
        const [intro, ...statements] = assignment.term_text.split('\n').filter((line) => line.trim());
        return { intro, statements, version: assignment.term_version, stored: true };
    }
    return { intro: ACCEPTANCE_TERM.intro, statements: [...ACCEPTANCE_TERM.statements], version: ACCEPTANCE_TERM.version, stored: false };
}

/** Nome do arquivo: declaracao-<contrato>-<fornecedor>.pdf (sem acento nem símbolo). */
export function declarationFileName(assignment) {
    const slug = (value) => String(value ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const parts = ['declaracao', slug(assignment.contract_number) || `solicitacao-${assignment.labor_request_id}`, slug(assignment.supplier_name)];
    return `${parts.filter(Boolean).join('-')}.pdf`;
}

/** Monta o PDF (Buffer) de um vínculo com a declaração assinada. */
export async function buildDeclarationPdf(assignment) {
    const declaration = await assignmentModel.getDeclaration(assignment.id);
    const company = declaration.filter((row) => row.category === DOCUMENT_CATEGORIES.COMPANY);
    const employee = declaration.filter((row) => row.category !== DOCUMENT_CATEGORIES.COMPANY);
    const term = signedTerm(assignment);
    const code = assignment.declaration_code ?? '—';
    const issuedAt = toBrDateTime(new Date());

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: 70, left: MARGIN, right: MARGIN },
        bufferPages: true,
        info: {
            Title: `Declaração do fornecedor - ${assignment.contract_number ?? assignment.labor_request_title}`,
            Author: 'DocsUp',
            Subject: 'Declaração de documentos e termo de aceite',
        },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });

    const width = doc.page.width - MARGIN * 2;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (height) => {
        if (doc.y + height > bottomLimit()) {
            doc.addPage();
            doc.rect(0, 0, doc.page.width, 6).fill(C.teal);
            doc.y = MARGIN;
        }
    };

    // ── Cabeçalho ──
    doc.rect(0, 0, doc.page.width, 78).fill(C.teal);
    doc.rect(0, 78, doc.page.width, 4).fill(C.cream);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(C.creamText).text('Docs', MARGIN, 28, { continued: true })
        .font('Helvetica').fillColor(C.cream).text('Up');
    doc.font('Helvetica').fontSize(10).fillColor(C.cream)
        .text('Declaração do fornecedor', MARGIN, 34, { width, align: 'right' });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.cream)
        .text(`Código de verificação ${code}`, MARGIN, 50, { width, align: 'right' });

    doc.y = 104;
    doc.font('Helvetica-Bold').fontSize(17).fillColor(C.text).text('Declaração de documentos e termo de aceite', MARGIN, doc.y, { width });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor(C.muted)
        .text(`${assignment.contract_number ? `Contrato ${assignment.contract_number} · ` : ''}${assignment.labor_request_title}`, { width });
    doc.moveDown(1);

    // keepWith: altura do que vem junto (o bloco não fica separado do título)
    const sectionTitle = (text, keepWith = 0) => {
        ensureSpace(40 + keepWith);
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.teal).text(text.toUpperCase(), MARGIN, doc.y, { width, characterSpacing: 0.6 });
        const y = doc.y + 3;
        doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.8).strokeColor(C.teal).stroke();
        doc.y = y + 8;
    };

    // Linhas "rótulo: valor"
    const keyValues = (rows) => {
        const labelWidth = 150;
        for (const [label, value] of rows) {
            const text = value === null || value === undefined || value === '' ? '—' : String(value);
            doc.font('Helvetica-Bold').fontSize(10);
            const height = Math.max(doc.heightOfString(text, { width: width - labelWidth - 10 }), 12) + 8;
            ensureSpace(height);
            const y = doc.y;
            doc.font('Helvetica').fontSize(9.5).fillColor(C.muted).text(label, MARGIN, y + 4, { width: labelWidth });
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text).text(text, MARGIN + labelWidth + 10, y + 4, { width: width - labelWidth - 10 });
            doc.moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).lineWidth(0.4).strokeColor(C.border).stroke();
            doc.y = y + height;
        }
    };

    // Tabela: columns [{ label, width (fração), align? }], rows [[{ text, color?, bold? }]]
    const table = (columns, rows) => {
        const widths = columns.map((column) => column.width * width);
        const drawHeader = () => {
            ensureSpace(24);
            const y = doc.y;
            doc.rect(MARGIN, y, width, 20).fill(C.teal);
            let x = MARGIN;
            columns.forEach((column, index) => {
                doc.font('Helvetica-Bold').fontSize(9).fillColor(C.creamText)
                    .text(column.label, x + 8, y + 6, { width: widths[index] - 16, align: column.align ?? 'left' });
                x += widths[index];
            });
            doc.y = y + 20;
        };
        drawHeader();
        rows.forEach((cells, rowIndex) => {
            doc.font('Helvetica').fontSize(9.5);
            const height = Math.max(...cells.map((cell, index) => doc.heightOfString(cell.text, { width: widths[index] - 16 }))) + 12;
            if (doc.y + height > bottomLimit()) {
                ensureSpace(height + 24);
                drawHeader();
            }
            const y = doc.y;
            if (rowIndex % 2 === 1) doc.rect(MARGIN, y, width, height).fill(C.soft);
            let x = MARGIN;
            cells.forEach((cell, index) => {
                doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(cell.color ?? C.text)
                    .text(cell.text, x + 8, y + 6, { width: widths[index] - 16, align: columns[index].align ?? 'left' });
                x += widths[index];
            });
            doc.moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).lineWidth(0.4).strokeColor(C.border).stroke();
            doc.y = y + height;
        });
    };

    // ── Contrato ──
    sectionTitle('Contrato');
    keyValues([
        ['Empresa (fornecedor)', assignment.supplier_name],
        ['CNPJ', assignment.supplier_cnpj],
        ['Contrato', assignment.contract_number],
        ['Serviço (solicitação)', assignment.labor_request_title],
        ['Local / obra', assignment.labor_request_location],
        ['Indicado por (Compras)', assignment.created_by_name],
        ['E-mail indicado', assignment.invite_email],
        ['Prazo dos documentos iniciais', toBrDateTime(assignment.deadline_at)],
        ['Situação da declaração', statusText(assignment)],
    ]);

    // ── Declaração ──
    sectionTitle('Documentos da empresa');
    if (company.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('Nenhum documento da empresa exigido.', MARGIN, doc.y, { width });
    } else {
        table(
            [{ label: 'Documento', width: 0.72 }, { label: 'Declaração', width: 0.28, align: 'center' }],
            company.map((row) => [
                { text: row.document_type_name },
                row.has_document
                    ? { text: 'Tem', color: C.success, bold: true }
                    : { text: 'Não tem', color: C.danger, bold: true },
            ]),
        );
    }

    sectionTitle('Documentos dos colaboradores');
    if (employee.length === 0) {
        doc.font('Helvetica').fontSize(10).fillColor(C.muted).text('Nenhum documento de colaborador a declarar (NRs e outros).', MARGIN, doc.y, { width });
    } else {
        table(
            [{ label: 'Documento', width: 0.72 }, { label: 'Colaboradores declarados', width: 0.28, align: 'center' }],
            employee.map((row) => [{ text: row.document_type_name }, { text: String(row.employee_count ?? '—'), bold: true }]),
        );
    }
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
        .text('Os documentos básicos (exigidos de todo colaborador) são enviados para cada colaborador cadastrado no portal.', MARGIN, doc.y, { width });

    // ── Termo ──
    sectionTitle('Termo de aceite digital');
    if (!term.stored) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(C.muted)
            .text(`Declaração assinada antes de o sistema guardar o texto do termo. Abaixo, o texto em vigor (versão ${term.version}).`, MARGIN, doc.y, { width });
        doc.moveDown(0.4);
    }
    doc.font('Helvetica').fontSize(10).fillColor(C.text).text(term.intro, MARGIN, doc.y, { width });
    doc.moveDown(0.5);
    for (const statement of term.statements) {
        doc.font('Helvetica').fontSize(10);
        const height = doc.heightOfString(statement, { width: width - 26 }) + 8;
        ensureSpace(height);
        const y = doc.y;
        // caixa marcada
        doc.rect(MARGIN, y + 1, 11, 11).lineWidth(1).strokeColor(C.teal).stroke();
        doc.moveTo(MARGIN + 2.5, y + 6.5).lineTo(MARGIN + 5, y + 9.5).lineTo(MARGIN + 9, y + 3)
            .lineWidth(1.6).strokeColor(C.teal).stroke();
        doc.fillColor(C.text).text(statement, MARGIN + 20, y, { width: width - 26 });
        doc.y = Math.max(doc.y, y + height);
    }
    if (term.version) {
        doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Versão do termo: ${term.version}`, MARGIN, doc.y, { width });
    }

    // ── Assinatura ──
    // A assinatura inteira (dados e código) fica na mesma página
    sectionTitle('Assinatura digital', 230);
    keyValues([
        ['Assinado por', assignment.declared_by_name],
        ['E-mail', assignment.declared_by_email],
        ['Papel na empresa', SUPPLIER_USER_ROLE_LABELS[assignment.declared_by_role] ?? null],
        ['Data e hora', brDateTimeSeconds(assignment.declared_at)],
        ['IP', assignment.acceptance_ip ?? 'IP não registrado'],
        ['Navegador', assignment.acceptance_user_agent ?? 'Não registrado'],
    ]);
    ensureSpace(60);
    doc.moveDown(0.8);
    const boxY = doc.y;
    doc.roundedRect(MARGIN, boxY, width, 46, 6).lineWidth(1).fillAndStroke('#e6efee', C.teal);
    doc.font('Helvetica').fontSize(9).fillColor(C.teal).text('Código de verificação', MARGIN + 14, boxY + 9, { width: width - 28 });
    doc.font('Courier-Bold').fontSize(16).fillColor(C.teal).text(code, MARGIN + 14, boxY + 22, { width: width - 28 });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
        .text('O mesmo código aparece no sistema, na declaração deste contrato.', MARGIN + 200, boxY + 27, { width: width - 214, align: 'right' });
    doc.y = boxY + 56;

    // ── Rodapé em todas as páginas ──
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const y = doc.page.height - 42;
        doc.moveTo(MARGIN, y - 6).lineTo(MARGIN + width, y - 6).lineWidth(0.4).strokeColor(C.border).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(`Emitido em ${issuedAt} pelo DocsUp · Código ${code}`, MARGIN, y, { width: width - 80, lineBreak: false });
        doc.text(`Página ${index - range.start + 1} de ${range.count}`, MARGIN, y, { width, align: 'right', lineBreak: false });
        doc.page.margins.bottom = bottom;
    }

    doc.end();
    return done;
}
