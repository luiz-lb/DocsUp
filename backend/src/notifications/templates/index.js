import { EVENT_TYPES } from '../../events/catalog.js';
import {
    appUrl, badge, bulletList, callout, dataTable, esc, infoRows, layout, paragraph, plainText, sectionTitle,
} from './layout.js';

/**
 * Um renderizador por tipo de evento: (data, recipient) → { subject, html, text }.
 * `data` vem do evento (montado pela API ou pelo agendador).
 */

function contractLine(data) {
    return data.contractNumber ? `${data.requestTitle} · Contrato ${data.contractNumber}` : data.requestTitle;
}

function contractRows(data) {
    return [
        { label: 'Serviço', value: data.requestTitle },
        { label: 'Contrato', value: data.contractNumber },
        { label: 'Local', value: data.location },
    ];
}

const MISSING_LIMIT = 20;

/** Bloco "o que falta enviar" dos avisos de prazo dos documentos iniciais. */
function missingBlock(missing) {
    if (!missing) return '';
    if (!missing.declared) {
        return callout('A declaração e o termo de aceite ainda não foram assinados: abra o contrato no portal para começar.', 'warning', 'Falta começar');
    }
    const lines = [
        ...missing.company.map((name) => `Empresa: ${name}`),
        ...missing.employee.map((item) => `${item.name}: ${item.sent} de ${item.declared} colaborador${item.declared === 1 ? '' : 'es'}`),
        ...missing.basics.map((item) => `Documentos básicos de ${item.employee} (${item.missing} faltando)`),
    ];
    if (lines.length === 0) return '';
    const shown = lines.slice(0, MISSING_LIMIT);
    const more = lines.length - shown.length;
    return sectionTitle('O que ainda falta enviar') + bulletList(more > 0 ? [...shown, `e mais ${more} item(ns)`] : shown);
}

function missingText(missing) {
    if (!missing) return [];
    if (!missing.declared) return ['Falta assinar a declaração e o termo de aceite.'];
    return [
        ...missing.company.map((name) => `- Empresa: ${name}`),
        ...missing.employee.map((item) => `- ${item.name}: ${item.sent} de ${item.declared}`),
        ...missing.basics.map((item) => `- Básicos de ${item.employee} (${item.missing})`),
    ];
}

const INVITE_TEXTS = {
    new: { eyebrow: 'Novo contrato', subject: 'Novo contrato' },
    resent: { eyebrow: 'Convite reenviado', subject: 'Convite reenviado' },
    replaced: { eyebrow: 'Novo contrato', subject: 'Novo contrato' },
};

// Calendário dos mensais: textos por aviso
const MONTHLY_TEXTS = {
    opened: {
        eyebrow: 'Mensais abertos', tone: 'brand',
        subject: (d) => `Documentos mensais de ${d.competence}: envio aberto`,
        title: (d) => `Documentos mensais de ${d.competence}`,
        intro: (d) => `Já dá para enviar os documentos trabalhistas mensais de <strong>${esc(d.competence)}</strong>. O prazo vai até <strong>${esc(d.dueDateText)}</strong>.`,
    },
    reminder: {
        eyebrow: 'Lembrete', tone: 'warning',
        subject: (d) => `Lembrete: documentos mensais de ${d.competence} até ${d.dueDateText}`,
        title: (d) => `Ainda faltam documentos de ${d.competence}`,
        intro: (d) => `O prazo dos documentos mensais de <strong>${esc(d.competence)}</strong> termina em <strong>${esc(d.dueDateText)}</strong>. Ainda falta enviar:`,
    },
    last_day: {
        eyebrow: 'Último dia', tone: 'warning',
        subject: (d) => `Último dia: documentos mensais de ${d.competence}`,
        title: (d) => `Hoje é o último dia: ${d.competence}`,
        intro: (d) => `O prazo dos documentos mensais de <strong>${esc(d.competence)}</strong> termina hoje (<strong>${esc(d.dueDateText)}</strong>). Depois disso o envio continua aceito, mas fica como atrasado.`,
    },
    overdue: {
        eyebrow: 'Atrasado', tone: 'danger',
        subject: (d) => `Atrasado: documentos mensais de ${d.competence}`,
        title: (d) => `Documentos de ${d.competence} atrasados`,
        intro: (d) => `O prazo terminou em <strong>${esc(d.dueDateText)}</strong>. Envie o quanto antes: o envio continua aceito, mas fica registrado como atrasado.`,
    },
};

const SITUATION_BADGES = {
    pending: ['A enviar', 'warning'],
    late: ['Atrasado', 'danger'],
    returned: ['Devolvido pelo RH', 'danger'],
    sent: ['Enviado', 'info'],
    approved: ['Aprovado', 'success'],
};

function monthlyRender(data) {
    const texts = MONTHLY_TEXTS[data.kind] ?? MONTHLY_TEXTS.opened;
    const contracts = data.contracts ?? [];
    const blocks = contracts.map((contract) => {
        const heading = `<p style="margin:22px 0 4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#111827;">${esc(contract.requestTitle)}${contract.contractNumber ? ` <span style="color:#6b7280;font-weight:400;">· Contrato ${esc(contract.contractNumber)}</span>` : ''}</p>`;
        const summary = data.kind === 'opened'
            ? paragraph(`${contract.total} documento${contract.total === 1 ? '' : 's'} para enviar neste mês.`)
            : '';
        const table = dataTable(
            [{ label: 'Documento' }, { label: 'Colaborador' }, { label: 'Situação', width: '28%' }],
            contract.items.map((item) => {
                const [label, toneName] = SITUATION_BADGES[item.situation] ?? [item.situation, 'neutral'];
                return [esc(item.name), item.employee ? esc(item.employee) : '<span style="color:#6b7280;">Empresa</span>', badge(label, toneName)];
            }),
        );
        const more = contract.moreItems > 0 ? paragraph(`<span style="color:#6b7280;">e mais ${contract.moreItems} item(ns) no portal.</span>`) : '';
        const link = contracts.length > 1
            ? `<p style="margin:0 0 8px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;"><a href="${esc(contract.contractUrl)}" style="color:#004643;font-weight:700;">Abrir este contrato →</a></p>`
            : '';
        return heading + summary + table + more + link;
    }).join('');
    const ctaUrl = contracts.length === 1 ? contracts[0].contractUrl : appUrl('/fornecedor/painel');
    return {
        subject: texts.subject(data),
        html: layout({
            preheader: `${texts.title(data)}. Prazo: ${data.dueDateText}.`,
            eyebrow: texts.eyebrow,
            eyebrowTone: texts.tone,
            title: texts.title(data),
            intro: texts.intro(data),
            body: blocks,
            cta: { label: contracts.length === 1 ? 'Enviar no portal' : 'Abrir o portal', url: ctaUrl },
            note: 'Os documentos de cada mês são enviados na aba "Documentos mensais" do contrato.',
        }),
        text: plainText({
            title: texts.title(data),
            lines: [`Prazo: ${data.dueDateText}`, ...contracts.map((contract) => `${contract.requestTitle}${contract.contractNumber ? ` (Contrato ${contract.contractNumber})` : ''}: ${data.kind === 'opened' ? contract.total : contract.todoCount} documento(s)`)],
            url: ctaUrl,
        }),
    };
}

const RENDERERS = {
    [EVENT_TYPES.SUPPLIER_INVITED](data) {
        const texts = INVITE_TEXTS[data.kind] ?? INVITE_TEXTS.new;
        const title = 'Sua empresa foi indicada para um serviço';
        return {
            subject: `${texts.subject}: ${contractLine(data)}`,
            html: layout({
                preheader: `Envie a documentação até ${data.deadlineText}.`,
                eyebrow: texts.eyebrow,
                eyebrowTone: 'brand',
                title,
                intro: data.kind === 'resent'
                    ? 'O convite deste contrato foi reenviado e o processo recomeçou. Entre no portal, confira os documentos exigidos, declare o que a empresa tem e envie a documentação dentro do novo prazo.'
                    : 'Entre no portal, confira os documentos exigidos, declare o que a empresa tem e envie a documentação dentro do prazo.',
                body: infoRows(contractRows(data))
                    + callout(`Envie os documentos iniciais até <strong>${esc(data.deadlineText)}</strong>.`, 'warning', 'Prazo'),
                cta: { label: 'Abrir no portal', url: data.inviteUrl },
                note: 'Ainda não tem cadastro? O mesmo link leva ao cadastro do fornecedor.',
            }),
            text: plainText({
                title,
                lines: [`Serviço: ${data.requestTitle}`, data.contractNumber ? `Contrato: ${data.contractNumber}` : null, `Prazo: ${data.deadlineText}`],
                url: data.inviteUrl,
            }),
        };
    },

    [EVENT_TYPES.SUPPLIER_DEADLINE_CHANGED](data) {
        const title = 'O prazo dos documentos mudou';
        return {
            subject: `Prazo alterado: ${contractLine(data)}`,
            html: layout({
                preheader: `Novo prazo: ${data.deadlineText}.`,
                eyebrow: 'Prazo alterado',
                eyebrowTone: 'warning',
                title,
                intro: 'O setor de Compras alterou o prazo dos documentos iniciais deste contrato.',
                body: infoRows([
                    ...contractRows(data),
                    { label: 'Prazo anterior', value: data.previousDeadlineText },
                    { label: 'Novo prazo', html: `<span style="color:#8a5300;">${esc(data.deadlineText)}</span>` },
                ]),
                cta: { label: 'Abrir o contrato', url: data.contractUrl },
            }),
            text: plainText({ title, lines: [contractLine(data), `Novo prazo: ${data.deadlineText}`], url: data.contractUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_ACCESS_REMOVED](data) {
        const title = 'Sua empresa não é mais o fornecedor deste contrato';
        return {
            subject: `Contrato encerrado para sua empresa: ${contractLine(data)}`,
            html: layout({
                preheader: 'O setor de Compras indicou outro fornecedor.',
                eyebrow: 'Fornecedor trocado',
                eyebrowTone: 'neutral',
                title,
                intro: 'O setor de Compras indicou outro fornecedor para o serviço abaixo. O acesso da sua empresa a este contrato foi encerrado; os documentos enviados ficam guardados.',
                body: infoRows(contractRows(data)),
                cta: { label: 'Ver meus contratos', url: data.portalUrl },
                note: 'Dúvidas? Fale com o setor de Compras.',
            }),
            text: plainText({ title, lines: [contractLine(data)], url: data.portalUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_DOCUMENT_RETURNED](data) {
        const title = `${data.statusLabel}: ${data.documentTypeName}`;
        return {
            subject: `${data.statusLabel}: ${data.documentTypeName} · ${contractLine(data)}`,
            html: layout({
                preheader: data.observation ? `Motivo: ${data.observation}` : 'O RH devolveu um documento.',
                eyebrow: data.statusLabel,
                eyebrowTone: 'danger',
                title,
                intro: 'O RH analisou um documento do contrato e precisa que ele seja enviado de novo.',
                body: infoRows([
                    { label: 'Serviço', value: data.requestTitle },
                    { label: 'Contrato', value: data.contractNumber },
                    { label: 'Documento', value: data.documentTypeName },
                    { label: 'Colaborador', value: data.employeeName },
                    { label: 'Competência', value: data.competence },
                ]) + (data.observation ? callout(esc(data.observation), 'danger', 'Motivo') : ''),
                cta: { label: 'Reenviar no portal', url: data.contractUrl },
                note: 'No portal, use o botão "Reenviar" no documento.',
            }),
            text: plainText({
                title,
                lines: [contractLine(data), data.employeeName ? `Colaborador: ${data.employeeName}` : null, data.competence ? `Competência: ${data.competence}` : null, data.observation ? `Motivo: ${data.observation}` : null],
                url: data.contractUrl,
            }),
        };
    },

    [EVENT_TYPES.SUPPLIER_DOCUMENTATION_APPROVED](data) {
        const title = 'Documentação aprovada';
        return {
            subject: `Documentação aprovada: ${contractLine(data)}`,
            html: layout({
                preheader: 'O RH aprovou todos os documentos iniciais.',
                eyebrow: 'Serviço liberado',
                eyebrowTone: 'success',
                title,
                intro: 'O RH aprovou todos os documentos iniciais. O contrato está com o <strong>serviço em andamento</strong>.',
                body: infoRows(contractRows(data))
                    + callout('Os documentos trabalhistas mensais (como espelho de ponto e holerite) continuam sendo cobrados todo mês: você recebe um aviso quando cada mês abrir para envio.', 'info', 'Próximos passos'),
                cta: { label: 'Abrir o contrato', url: data.contractUrl },
            }),
            text: plainText({ title, lines: [contractLine(data)], url: data.contractUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_CONTRACT_CONCLUDED](data) {
        const title = 'Contrato concluído';
        return {
            subject: `Contrato concluído: ${contractLine(data)}`,
            html: layout({
                preheader: `Mensais cobrados até ${data.lastCompetence}.`,
                eyebrow: 'Contrato concluído',
                eyebrowTone: 'success',
                title,
                intro: `O contrato abaixo foi concluído em <strong>${esc(data.concludedText)}</strong>.`,
                body: infoRows([
                    { label: 'Serviço', value: data.requestTitle },
                    { label: 'Contrato', value: data.contractNumber },
                ]) + callout(`Os documentos mensais são cobrados até a competência de <strong>${esc(data.lastCompetence)}</strong>. Se faltar algum, envie pelo portal.`, 'info'),
                cta: { label: 'Abrir o contrato', url: data.contractUrl },
            }),
            text: plainText({ title, lines: [contractLine(data), `Mensais até: ${data.lastCompetence}`], url: data.contractUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_REMINDER](data) {
        const title = 'O prazo dos documentos está acabando';
        return {
            subject: `Prazo acabando (faltam ${data.hoursLeft} h): ${contractLine(data)}`,
            html: layout({
                preheader: `O prazo termina em ${data.deadlineText}.`,
                eyebrow: `Faltam ${data.hoursLeft} h`,
                eyebrowTone: 'warning',
                title,
                intro: `Ainda falta enviar documentos deste contrato. O prazo termina em <strong>${esc(data.deadlineText)}</strong>.`,
                body: infoRows(contractRows(data)) + missingBlock(data.missing),
                cta: { label: 'Enviar documentos', url: data.contractUrl },
                note: 'Depois do prazo, novos envios ficam bloqueados: só dá para reenviar o que o RH devolver.',
            }),
            text: plainText({ title, lines: [contractLine(data), `Prazo: ${data.deadlineText}`, ...missingText(data.missing)], url: data.contractUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_EXPIRED](data) {
        const title = 'O prazo dos documentos iniciais acabou';
        return {
            subject: `Prazo dos documentos vencido: ${contractLine(data)}`,
            html: layout({
                preheader: `O prazo terminou em ${data.deadlineText}.`,
                eyebrow: 'Prazo vencido',
                eyebrowTone: 'danger',
                title,
                intro: `O prazo terminou em <strong>${esc(data.deadlineText)}</strong> e ainda faltam documentos. Novos envios ficaram bloqueados; o setor de Compras foi avisado.`,
                body: infoRows(contractRows(data)) + missingBlock(data.missing),
                cta: { label: 'Abrir o contrato', url: data.contractUrl },
                note: 'Fale com o setor de Compras sobre os próximos passos.',
            }),
            text: plainText({ title, lines: [contractLine(data), `Prazo: ${data.deadlineText}`, ...missingText(data.missing)], url: data.contractUrl }),
        };
    },

    [EVENT_TYPES.SUPPLIER_MONTHLY_OPENED]: monthlyRender,
    [EVENT_TYPES.SUPPLIER_MONTHLY_REMINDER]: monthlyRender,
    [EVENT_TYPES.SUPPLIER_MONTHLY_LAST_DAY]: monthlyRender,
    [EVENT_TYPES.SUPPLIER_MONTHLY_OVERDUE]: monthlyRender,

    [EVENT_TYPES.PURCHASING_CONTRACT_BLOCKED](data) {
        const title = 'Fornecedor sem documento da empresa';
        const url = appUrl(`/solicitacoes/${data.requestId}`);
        return {
            subject: `Convite pausado: ${contractLine(data)}`,
            html: layout({
                preheader: `${data.supplierName} declarou que não tem documento da empresa.`,
                eyebrow: 'Solicitação bloqueada',
                eyebrowTone: 'danger',
                title,
                intro: `<strong>${esc(data.supplierName)}</strong> declarou que não tem documento da empresa exigido. O convite ficou pausado até Compras decidir.`,
                body: infoRows([
                    { label: 'Solicitação', value: data.requestTitle },
                    { label: 'Contrato', value: data.contractNumber },
                    { label: 'Fornecedor', value: data.supplierName },
                    { label: 'E-mail indicado', value: data.inviteEmail },
                    { label: 'Assinado por', value: data.declaredBy },
                ]) + callout(bulletList(data.missingDocuments ?? [], 'danger'), 'danger', 'Documentos que o fornecedor não tem')
                    + paragraph('Reenvie o convite para o mesmo e-mail (recomeça do zero, com novo prazo) ou troque o fornecedor.'),
                cta: { label: 'Abrir a solicitação', url },
            }),
            text: plainText({
                title,
                lines: [`Solicitação: ${contractLine(data)}`, `Fornecedor: ${data.supplierName}`, `Não tem: ${(data.missingDocuments ?? []).join(', ')}`],
                url,
            }),
        };
    },

    [EVENT_TYPES.PURCHASING_INITIAL_DEADLINE_EXPIRED](data) {
        const title = 'Fornecedor não enviou os documentos no prazo';
        const url = appUrl(`/solicitacoes/${data.requestId}`);
        return {
            subject: `Prazo vencido sem documentos: ${contractLine(data)}`,
            html: layout({
                preheader: `${data.supplierName}: prazo terminou em ${data.deadlineText}.`,
                eyebrow: 'Prazo vencido',
                eyebrowTone: 'danger',
                title,
                intro: `<strong>${esc(data.supplierName)}</strong> não enviou todos os documentos iniciais até <strong>${esc(data.deadlineText)}</strong>.`,
                body: infoRows([
                    { label: 'Solicitação', value: data.requestTitle },
                    { label: 'Contrato', value: data.contractNumber },
                    { label: 'Fornecedor', value: data.supplierName },
                    { label: 'E-mail indicado', value: data.inviteEmail },
                ]) + missingBlock(data.missing) + paragraph('Na solicitação, altere o prazo ou troque o fornecedor.'),
                cta: { label: 'Abrir a solicitação', url },
            }),
            text: plainText({ title, lines: [contractLine(data), `Fornecedor: ${data.supplierName}`, ...missingText(data.missing)], url }),
        };
    },
};

export function hasRenderer(type) {
    return Boolean(RENDERERS[type]);
}

/** Monta o e-mail de um evento. Lança erro se o tipo não tiver modelo. */
export function renderEvent(event, recipient) {
    const renderer = RENDERERS[event.type];
    if (!renderer) throw new Error(`Sem modelo de e-mail para o evento ${event.type}`);
    return renderer(event.data ?? {}, recipient, event);
}
