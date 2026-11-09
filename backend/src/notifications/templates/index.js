import { EVENT_TYPES } from '../../events/catalog.js';
import {
    appUrl, bulletList, callout, esc, infoRows, layout, paragraph, plainText,
} from './layout.js';

/**
 * Um renderizador por tipo de evento: (data, recipient) → { subject, html, text }.
 * `data` vem do evento (montado pela API ou pelo agendador).
 */

function contractLine(data) {
    return data.contractNumber ? `${data.requestTitle} · Contrato ${data.contractNumber}` : data.requestTitle;
}

const INVITE_TEXTS = {
    new: { eyebrow: 'Novo contrato', subject: 'Novo contrato' },
    resent: { eyebrow: 'Convite reenviado', subject: 'Convite reenviado' },
    replaced: { eyebrow: 'Novo contrato', subject: 'Novo contrato' },
};

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
                body: infoRows([
                    { label: 'Serviço', value: data.requestTitle },
                    { label: 'Contrato', value: data.contractNumber },
                    { label: 'Local', value: data.location },
                ]) + callout(`Envie os documentos iniciais até <strong>${esc(data.deadlineText)}</strong>.`, 'warning', 'Prazo'),
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
