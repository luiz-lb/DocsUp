import { open } from '../../utils/secretBox.js';
import { EVENT_TYPES } from '../../events/catalog.js';
import {
    appUrl, badge, bulletList, callout, dataTable, esc, infoRows, layout, paragraph, plainText, sectionTitle, statCards,
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
        ...(missing.noEmployees ? ['Cadastre os colaboradores que vão atuar na obra, com os documentos básicos'] : []),
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
        ...(missing.noEmployees ? ['- Cadastre os colaboradores da obra'] : []),
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

const DOC_STATUS_TONES = { 0: 'warning', 1: 'info', 2: 'success', 3: 'danger', 4: 'danger', 5: 'neutral' };

function digestRender(data) {
    const t = data.totals;
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const subject = t.documents > 0
        ? `Resumo do RH: ${plural(t.documents, 'documento', 'documentos')} de ${plural(t.suppliers, 'fornecedor', 'fornecedores')} (${data.periodText})`
        : `Resumo do RH: novidades de ${data.periodText}`;
    const stats = statCards([
        { label: 'Documentos recebidos', value: t.documents, tone: 'brand' },
        { label: 'Reenviados', value: t.resent, tone: t.resent > 0 ? 'warning' : 'neutral' },
        { label: 'Fornecedores', value: t.suppliers, tone: 'info' },
        { label: 'Bloqueios / prazos', value: t.blocked + t.expired, tone: t.blocked + t.expired > 0 ? 'danger' : 'neutral' },
    ]);

    const documentsBlock = (data.suppliers ?? []).map((supplier) => {
        const contracts = supplier.contracts.map((contract) => {
            const label = contract.contractNumber ? `Contrato ${contract.contractNumber} · ${contract.title}` : contract.title;
            const link = contract.requestId ? ` <a href="${esc(appUrl(`/solicitacoes/${contract.requestId}`))}" style="color:#004643;font-size:12px;">abrir</a>` : '';
            return `<p style="margin:10px 0 4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#374151;">${esc(label)}${link}</p>`
                + dataTable(
                    [{ label: 'Documento' }, { label: 'Colaborador / mês' }, { label: 'Situação', width: '30%' }],
                    contract.documents.map((doc) => [
                        `${esc(doc.name)}${doc.resent ? ` ${badge('Reenviado', 'warning')}` : ''}`,
                        [doc.employee ? esc(doc.employee) : '<span style="color:#6b7280;">Empresa</span>', doc.competence ? `<span style="color:#6b7280;">${esc(doc.competence)}</span>` : ''].filter(Boolean).join('<br>'),
                        badge(doc.statusLabel, DOC_STATUS_TONES[doc.status] ?? 'neutral'),
                    ]),
                );
        }).join('');
        return `<p style="margin:22px 0 2px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;color:#004643;">${esc(supplier.name)}</p>` + contracts;
    }).join('');

    const declarations = (data.declarations ?? []).length > 0
        ? sectionTitle('Declarações assinadas') + bulletList(data.declarations.map((item) =>
            `${item.supplierName}: ${item.contractNumber ? `Contrato ${item.contractNumber} · ` : ''}${item.title}${item.blocked ? ' (bloqueada: não tem documento da empresa)' : ''}`))
        : '';
    const expired = (data.expired ?? []).length > 0
        ? sectionTitle('Prazos dos documentos iniciais que venceram') + bulletList(data.expired.map((item) =>
            `${item.supplierName}: ${item.contractNumber ? `Contrato ${item.contractNumber} · ` : ''}${item.title} (prazo ${item.deadlineText})`), 'danger')
        : '';
    const more = data.moreDocuments > 0 ? paragraph(`<span style="color:#6b7280;">e mais ${data.moreDocuments} documento(s) no sistema.</span>`) : '';
    const url = appUrl('/documentos/fornecedores');

    return {
        subject,
        html: layout({
            preheader: `${plural(t.documents, 'documento recebido', 'documentos recebidos')}${t.resent ? `, ${t.resent} reenviado(s)` : ''}.`,
            eyebrow: 'Resumo do RH',
            eyebrowTone: 'brand',
            title: 'Novidades da documentação',
            intro: `Período: <strong>${esc(data.periodText)}</strong>.`,
            body: stats
                + (documentsBlock ? sectionTitle('Documentos recebidos') + documentsBlock + more : '')
                + declarations + expired,
            cta: { label: 'Abrir Docs de Fornecedores', url },
            note: `Este resumo sai a cada ${data.intervalHours ?? 1} hora(s), só quando há novidade. Para mudar, use Parâmetros → Notificações.`,
        }),
        text: plainText({
            title: `Resumo do RH (${data.periodText})`,
            lines: [
                `Documentos recebidos: ${t.documents} (reenviados: ${t.resent})`,
                ...(data.suppliers ?? []).flatMap((supplier) => supplier.contracts.flatMap((contract) => contract.documents.map((doc) =>
                    `- ${supplier.name} · ${contract.contractNumber ?? contract.title}: ${doc.name}${doc.employee ? ` (${doc.employee})` : ''}${doc.resent ? ' [reenviado]' : ''}`))),
                t.declarations ? `Declarações assinadas: ${t.declarations} (bloqueadas: ${t.blocked})` : null,
                t.expired ? `Prazos vencidos: ${t.expired}` : null,
            ],
            url,
        }),
    };
}

const RENDERERS = {
    // Código de acesso: aberto só aqui, na hora de montar o e-mail (nunca vai para log nem para o registro)
    [EVENT_TYPES.SUPPLIER_ACCESS_CODE](data) {
        const code = open(data.sealedCode);
        if (!/^[0-9]{6}$/.test(code)) throw new Error('código de acesso inválido');
        return {
            subject: 'Seu código de acesso ao Portal do Fornecedor',
            html: layout({
                preheader: 'Use este código para entrar no Portal do Fornecedor.',
                eyebrow: 'Código de acesso',
                title: 'Portal do Fornecedor',
                intro: `Olá, ${esc(data.name)}. Um acesso foi pedido para <strong>${esc(data.companyName)}</strong>. Seu código é:`,
                body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr>
                    <td align="center" style="background:#f6f7f6;border:1px dashed #b9d3d0;border-radius:12px;padding:18px;font-family:Consolas,'Courier New',monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:#004643;">${code}</td>
                </tr></table>`,
                note: 'O código vale por 10 minutos. Se não foi você, ignore este e-mail: ninguém entra sem a senha.',
            }),
        };
    },

    [EVENT_TYPES.RH_DIGEST]: digestRender,

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
