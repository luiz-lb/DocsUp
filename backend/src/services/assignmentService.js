import crypto from 'crypto';
import * as assignmentModel from '../models/assignmentModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as supplierUserModel from '../models/supplierUserModel.js';
import * as documentTypeModel from '../models/documentTypeModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { sendMail, escapeHtml, isMailEnabled } from './mailService.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { normalizeEmail } from '../utils/email.js';
import { parseLocalDateTime, toLocalDateTimeText } from '../utils/dates.js';
import { toInteger } from '../utils/parse.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { SUPPLIER_STATUSES } from '../constants/supplierUsers.js';
import { DEPARTMENTS } from '../constants/departments.js';
import { DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';
import {
    ASSIGNMENT_END_REASONS,
    ASSIGNMENT_STATUSES,
    DEADLINE_MAX_DAYS_AHEAD,
    DEADLINE_MAX_HOURS,
    LABOR_REQUEST_STATUSES,
} from '../constants/laborRequest.js';

// Violação de UNIQUE (dois cliques ao mesmo tempo criando o vínculo da mesma solicitação)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];
const REASON_MIN_LENGTH = 5;
const REASON_MAX_LENGTH = 1000;

const ASSIGNMENT_ROLES = [DEPARTMENTS.SUPRIMENTOS, DEPARTMENTS.ADMIN];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/** Link que o fornecedor abre (login / cadastro e depois a declaração e os documentos). */
export function inviteLink(token) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return `${frontendUrl}/fase2/${token}`;
}

/** Prazo encerrado? (depois dele, só reenvio do que o RH devolveu) */
export function isDeadlineClosed(assignment) {
    return new Date() > new Date(assignment.deadline_at);
}

/**
 * Prazo dos documentos iniciais: em horas a partir de agora (deadlineHours, 1 a 720) ou até
 * uma data e hora (deadlineAt 'YYYY-MM-DDTHH:mm', no futuro e até 1 ano à frente).
 * Retorna { value: Date, hours? } ou { error }.
 */
export function resolveDeadline({ deadlineHours, deadlineAt } = {}, now = new Date()) {
    const hasHours = deadlineHours !== undefined && deadlineHours !== null && deadlineHours !== '';
    const hasDate = typeof deadlineAt === 'string' && deadlineAt.trim() !== '';
    if (hasHours === hasDate) {
        return { error: 'Informe o prazo em horas ou até uma data (só um dos dois).' };
    }

    if (hasHours) {
        const hours = toInteger(deadlineHours);
        if (!Number.isInteger(hours) || hours < 1 || hours > DEADLINE_MAX_HOURS) {
            return { error: `O prazo em horas tem que ser um número inteiro de 1 a ${DEADLINE_MAX_HOURS}.` };
        }
        const value = new Date(now.getTime() + hours * 60 * 60 * 1000);
        value.setSeconds(0, 0);
        return { value, hours };
    }

    const value = parseLocalDateTime(deadlineAt);
    if (!value) return { error: 'Data do prazo inválida.' };
    if (value <= now) return { error: 'O prazo tem que ser uma data e hora futuras.' };
    const limit = new Date(now);
    limit.setDate(limit.getDate() + DEADLINE_MAX_DAYS_AHEAD);
    if (value > limit) return { error: 'O prazo pode ser de no máximo 1 ano.' };
    return { value };
}

/** Quem pode indicar / trocar o fornecedor (o backend confere de novo nas rotas). */
function canManage(viewer) {
    return ASSIGNMENT_ROLES.includes(viewer?.department);
}

/** Vínculo como o painel interno vê. O link do convite só vai para quem gerencia. */
function publicAssignment(assignment, { withLink }) {
    if (!assignment) return null;
    return {
        id: assignment.id,
        status: assignment.status,
        supplierId: assignment.supplier_id,
        supplierName: assignment.supplier_name ?? null,
        supplierCnpj: assignment.supplier_cnpj ?? null,
        inviteEmail: assignment.invite_email,
        deadlineAt: assignment.deadline_at,
        isExpired: isDeadlineClosed(assignment),
        createdAt: assignment.created_at,
        createdByName: assignment.created_by_name ?? null,
        linkedAt: assignment.linked_at,
        declaredAt: assignment.declared_at,
        declaredByName: assignment.declared_by_name ?? null,
        acceptanceIp: assignment.acceptance_ip ?? null,
        blockedAt: assignment.blocked_at,
        endedAt: assignment.ended_at,
        endedByName: assignment.ended_by_name ?? null,
        endReason: assignment.end_reason,
        endComment: assignment.end_comment ?? null,
        ...(withLink && assignment.status !== ASSIGNMENT_STATUSES.ENDED
            ? { inviteLink: inviteLink(assignment.invite_token) }
            : {}),
    };
}

/**
 * Fornecedor dono do e-mail (usuário ativo), para vincular o convite na hora.
 * Retorna { supplierId, supplierName } (supplierId null se o e-mail não tem cadastro) ou { error }.
 */
async function supplierForEmail(email) {
    const user = await supplierUserModel.findActiveUserByEmail(email);
    if (!user) return { supplierId: null, supplierName: null };
    if (user.supplier_status === SUPPLIER_STATUSES.BLOCKED) {
        return { error: 'Este fornecedor está bloqueado no portal. Escolha outro fornecedor.' };
    }
    if (user.supplier_status === SUPPLIER_STATUSES.INACTIVE) {
        return { error: 'Este fornecedor está inativo no portal. Escolha outro fornecedor.' };
    }
    return { supplierId: user.supplier_id, supplierName: user.razao_social };
}

/** Avisa o fornecedor do convite por e-mail (com o envio desligado, só registra no log). */
async function notifySupplierInvite({ email, request, token, deadlineAt, isNew }) {
    const link = inviteLink(token);
    const contract = request.contract_number ? ` · Contrato ${escapeHtml(request.contract_number)}` : '';
    await sendMail({
        to: email,
        subject: `${isNew ? 'Novo contrato' : 'Convite reenviado'}: ${request.title}`,
        html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
                <h2 style="color: #004643;">Documentação do contrato</h2>
                <p>Sua empresa foi indicada para o serviço:</p>
                <p style="font-size: 1.1rem; font-weight: bold;">${escapeHtml(request.title)}${contract}</p>
                <p><strong>Local:</strong> ${escapeHtml(request.location ?? '—')}</p>
                <p>Entre no portal, confira os documentos exigidos, declare o que a empresa tem e envie a
                   documentação até <strong>${new Date(deadlineAt).toLocaleString('pt-BR')}</strong>.</p>
                <p style="margin-top: 1.5rem;">
                    <a href="${link}"
                       style="background:#004643; color:#fff; padding:12px 24px;
                              border-radius:6px; text-decoration:none; font-weight:bold;">
                        Abrir no portal
                    </a>
                </p>
                <p style="color:#6b7280; font-size:0.8rem; margin-top:1rem;">
                    Ainda não tem cadastro? O link leva ao cadastro do fornecedor.
                </p>
            </div>
        `,
    });
}

/**
 * Solicitação concluída ou cancelada não muda mais de fornecedor nem de prazo.
 * Retorna { request } ou { error }.
 */
async function loadChangeableRequest(laborRequestId) {
    const request = await laborRequestModel.getLaborRequestById(laborRequestId);
    if (!request) return { error: { status: 404, message: 'Solicitação não encontrada.' } };
    if ([LABOR_REQUEST_STATUSES.CONCLUDED, LABOR_REQUEST_STATUSES.CANCELED].includes(request.status)) {
        return { error: { status: 400, message: 'O contrato desta solicitação já foi concluído.' } };
    }
    return { request };
}

/** Registra na auditoria uma ação de Compras sobre o fornecedor da solicitação. */
async function auditAssignment(transaction, context, action, laborRequestId, oldValues, newValues) {
    await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
        context, action, AUDIT_ENTITIES.LABOR_REQUEST, laborRequestId, oldValues, newValues,
    ));
}

/** Snapshot do vínculo para a auditoria. */
function auditSnapshot(assignment) {
    if (!assignment) return null;
    return {
        assignment_id: assignment.id,
        invite_email: assignment.invite_email,
        supplier: assignment.supplier_name ?? null,
        deadline_at: toLocalDateTimeText(assignment.deadline_at),
        status: assignment.status,
    };
}

/**
 * O que o fornecedor precisa declarar: documentos da empresa exigidos (tem / não tem) e os
 * documentos de colaborador exigidos, NR e outros (quantos funcionários têm). Os básicos
 * valem para todo colaborador e não entram.
 */
export async function getDeclarationItems(laborRequestId) {
    const [companyTypes, employeeTypes] = await Promise.all([
        documentTypeModel.getRequiredCompanyDocumentTypes(laborRequestId),
        documentTypeModel.getEmployeeDocumentTypesForRequest(laborRequestId),
    ]);
    return {
        company: companyTypes.map((type) => ({ id: type.id, name: type.name, description: type.description ?? null })),
        employee: employeeTypes
            .filter((type) => type.required
                && [DOCUMENT_CATEGORIES.EMPLOYEE_NR, DOCUMENT_CATEGORIES.EMPLOYEE_OTHER].includes(type.category))
            .map((type) => ({ id: type.id, name: type.name, category: type.category, code: type.code ?? null })),
    };
}

// ─────────────────────────────────────────────
// Leitura (painel interno)
// ─────────────────────────────────────────────

/**
 * Fornecedor da solicitação: o vínculo aberto (com a declaração e o que era para declarar)
 * e o histórico dos vínculos encerrados. O link do convite só vai para Compras / Admin.
 */
export async function getRequestSupplier(laborRequestId, viewer) {
    try {
        const all = await assignmentModel.listByRequest(laborRequestId);
        const current = all.find((assignment) => assignment.status !== ASSIGNMENT_STATUSES.ENDED) ?? null;
        const withLink = canManage(viewer);

        let declaration = [];
        let declarationItems = null;
        if (current) {
            [declaration, declarationItems] = await Promise.all([
                assignmentModel.getDeclaration(current.id),
                getDeclarationItems(laborRequestId),
            ]);
        }

        return {
            success: true,
            body: {
                current: publicAssignment(current, { withLink }),
                declaration,
                declarationItems,
                history: all
                    .filter((assignment) => assignment.status === ASSIGNMENT_STATUSES.ENDED)
                    .map((assignment) => publicAssignment(assignment, { withLink: false })),
                canManage: withLink,
                mailEnabled: isMailEnabled(),
            },
        };
    } catch (error) {
        console.error('getRequestSupplier error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar o fornecedor da solicitação.' };
    }
}

/** O e-mail já tem cadastro no portal? (modal de indicar fornecedor) */
export async function lookupSupplierEmail(rawEmail) {
    const email = normalizeEmail(rawEmail);
    if (!email) return { success: false, status: 400, message: 'Informe um e-mail válido.' };
    try {
        const user = await supplierUserModel.findActiveUserByEmail(email);
        if (!user) return { success: true, body: { email, registered: false } };
        return {
            success: true,
            body: {
                email,
                registered: true,
                supplier: {
                    id: user.supplier_id,
                    razaoSocial: user.razao_social,
                    cnpj: user.cnpj,
                    status: user.supplier_status,
                },
                user: { name: user.name, role: user.role },
            },
        };
    } catch (error) {
        console.error('lookupSupplierEmail error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar o e-mail.' };
    }
}

// ─────────────────────────────────────────────
// Ações de Compras
// ─────────────────────────────────────────────

/**
 * Indica o fornecedor da solicitação (aprovada, ainda sem fornecedor) pelo e-mail e define o
 * prazo dos documentos iniciais. E-mail de um usuário do portal → vinculado na hora (a
 * solicitação aparece para ele); senão o link leva ao cadastro. A solicitação vai para
 * Em contratação.
 *
 * @param {{ email, deadlineHours?, deadlineAt? }} payload
 * @param {{ id }} actor — colaborador logado (Compras / Admin)
 */
export async function assignSupplier(laborRequestId, payload = {}, actor, context = {}) {
    const email = normalizeEmail(payload.email);
    if (!email) return { success: false, status: 400, message: 'Informe um e-mail válido do fornecedor.' };
    const deadline = resolveDeadline(payload);
    if (deadline.error) return { success: false, status: 400, message: deadline.error };

    const request = await laborRequestModel.getLaborRequestById(laborRequestId);
    if (!request) return { success: false, status: 404, message: 'Solicitação não encontrada.' };
    if (request.status !== LABOR_REQUEST_STATUSES.AWAITING_SUPPLIER) {
        return {
            success: false,
            status: 400,
            message: 'Só dá para indicar o fornecedor de uma solicitação aprovada e ainda sem fornecedor.',
        };
    }
    if (await assignmentModel.getOpenByRequest(laborRequestId)) {
        return { success: false, status: 409, message: 'Esta solicitação já tem um fornecedor indicado.' };
    }

    const supplier = await supplierForEmail(email);
    if (supplier.error) return { success: false, status: 400, message: supplier.error };

    const token = generateToken();
    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            await assignmentModel.insert(transaction, {
                laborRequestId,
                supplierId: supplier.supplierId,
                inviteEmail: email,
                inviteToken: token,
                deadlineAt: deadline.value,
                createdBy: actor.id,
            });
            await laborRequestModel.updateLaborRequestStatus(
                transaction, laborRequestId, LABOR_REQUEST_STATUSES.IN_CONTRACTING, actor.id,
            );
            await auditAssignment(transaction, context, AUDIT_ACTIONS.SUPPLIER_ASSIGNMENT_CREATE, laborRequestId, null, {
                invite_email: email,
                supplier: supplier.supplierName,
                deadline_at: toLocalDateTimeText(deadline.value),
            });
        });
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: 'Esta solicitação já tem um fornecedor indicado.' };
        }
        console.error('assignSupplier error:', error);
        return { success: false, status: 500, message: 'Erro ao indicar o fornecedor.' };
    }

    await notifySupplierInvite({ email, request, token, deadlineAt: deadline.value, isNew: true });

    return {
        success: true,
        body: {
            message: supplier.supplierId
                ? `Fornecedor indicado: ${supplier.supplierName}. A solicitação já aparece no portal dele.`
                : 'Convite criado. O e-mail ainda não tem cadastro: o link leva ao cadastro do fornecedor.',
            registered: Boolean(supplier.supplierId),
            inviteLink: inviteLink(token),
            mailEnabled: isMailEnabled(),
        },
    };
}

/**
 * Reenvia o convite para o mesmo e-mail e recomeça do zero (nova declaração, novo link e novo
 * prazo). Para convite aguardando o fornecedor ou bloqueado (fornecedor sem documento da empresa).
 */
export async function resendInvite(laborRequestId, payload = {}, actor, context = {}) {
    const deadline = resolveDeadline(payload);
    if (deadline.error) return { success: false, status: 400, message: deadline.error };

    const loaded = await loadChangeableRequest(laborRequestId);
    if (loaded.error) return { success: false, ...loaded.error };

    const current = await assignmentModel.getOpenByRequest(laborRequestId);
    if (!current) return { success: false, status: 404, message: 'Esta solicitação não tem fornecedor indicado.' };
    if (![ASSIGNMENT_STATUSES.WAITING_SUPPLIER, ASSIGNMENT_STATUSES.BLOCKED].includes(current.status)) {
        return {
            success: false,
            status: 400,
            message: 'O fornecedor já assinou a declaração e está enviando os documentos. Para recomeçar, troque o fornecedor.',
        };
    }

    const supplier = await supplierForEmail(current.invite_email);
    if (supplier.error) return { success: false, status: 400, message: supplier.error };
    const supplierId = supplier.supplierId ?? current.supplier_id ?? null;

    const token = generateToken();
    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            const ended = await assignmentModel.end(transaction, current.id, {
                endedBy: actor.id, reason: ASSIGNMENT_END_REASONS.RESENT, comment: null,
            });
            if (!ended) throw Object.assign(new Error('O vínculo mudou.'), { conflict: true });

            await assignmentModel.insert(transaction, {
                laborRequestId,
                supplierId,
                inviteEmail: current.invite_email,
                inviteToken: token,
                deadlineAt: deadline.value,
                createdBy: actor.id,
            });
            await laborRequestModel.updateLaborRequestStatus(
                transaction, laborRequestId, LABOR_REQUEST_STATUSES.IN_CONTRACTING, actor.id,
            );
            await auditAssignment(transaction, context, AUDIT_ACTIONS.SUPPLIER_ASSIGNMENT_RESEND, laborRequestId,
                auditSnapshot(current),
                { invite_email: current.invite_email, deadline_at: toLocalDateTimeText(deadline.value) });
        });
    } catch (error) {
        if (error.conflict || SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: 'O fornecedor desta solicitação mudou. Atualize a tela.' };
        }
        console.error('resendInvite error:', error);
        return { success: false, status: 500, message: 'Erro ao reenviar o convite.' };
    }

    await notifySupplierInvite({ email: current.invite_email, request: loaded.request, token, deadlineAt: deadline.value, isNew: false });

    return {
        success: true,
        body: {
            message: 'Convite reenviado. O fornecedor recomeça do zero: nova declaração e novo prazo.',
            inviteLink: inviteLink(token),
            mailEnabled: isMailEnabled(),
        },
    };
}

/** Novo prazo dos documentos iniciais (convite aguardando ou fornecedor ativo). */
export async function changeDeadline(laborRequestId, payload = {}, actor, context = {}) {
    const deadline = resolveDeadline(payload);
    if (deadline.error) return { success: false, status: 400, message: deadline.error };

    const loaded = await loadChangeableRequest(laborRequestId);
    if (loaded.error) return { success: false, ...loaded.error };

    const current = await assignmentModel.getOpenByRequest(laborRequestId);
    if (!current) return { success: false, status: 404, message: 'Esta solicitação não tem fornecedor indicado.' };
    if (current.status === ASSIGNMENT_STATUSES.BLOCKED) {
        return { success: false, status: 400, message: 'O convite está bloqueado: reenvie o convite ou troque o fornecedor.' };
    }

    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            await assignmentModel.updateDeadline(transaction, current.id, deadline.value);
            await auditAssignment(transaction, context, AUDIT_ACTIONS.SUPPLIER_ASSIGNMENT_DEADLINE, laborRequestId,
                { deadline_at: toLocalDateTimeText(current.deadline_at) },
                { deadline_at: toLocalDateTimeText(deadline.value) });
        });
        return { success: true, body: { message: 'Prazo dos documentos atualizado.' } };
    } catch (error) {
        console.error('changeDeadline error:', error);
        return { success: false, status: 500, message: 'Erro ao mudar o prazo.' };
    }
}

/**
 * Troca o fornecedor da solicitação (ex.: não está entregando os documentos). Encerra o
 * vínculo atual com o motivo (o fornecedor anterior perde o acesso; os documentos que ele
 * enviou ficam guardados) e cria o convite para o novo e-mail, com novo prazo.
 *
 * @param {{ email, reason, deadlineHours?, deadlineAt? }} payload
 */
export async function replaceSupplier(laborRequestId, payload = {}, actor, context = {}) {
    const email = normalizeEmail(payload.email);
    if (!email) return { success: false, status: 400, message: 'Informe um e-mail válido do novo fornecedor.' };
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (reason.length < REASON_MIN_LENGTH) {
        return { success: false, status: 400, message: 'Informe o motivo da troca do fornecedor.' };
    }
    if (reason.length > REASON_MAX_LENGTH) {
        return { success: false, status: 400, message: `O motivo pode ter no máximo ${REASON_MAX_LENGTH} caracteres.` };
    }
    const deadline = resolveDeadline(payload);
    if (deadline.error) return { success: false, status: 400, message: deadline.error };

    const loaded = await loadChangeableRequest(laborRequestId);
    if (loaded.error) return { success: false, ...loaded.error };

    const current = await assignmentModel.getOpenByRequest(laborRequestId);
    if (!current) return { success: false, status: 404, message: 'Esta solicitação não tem fornecedor indicado.' };
    if (current.invite_email === email) {
        return {
            success: false,
            status: 400,
            message: 'É o mesmo e-mail do fornecedor atual. Para recomeçar com ele, use "Reenviar convite".',
        };
    }

    const supplier = await supplierForEmail(email);
    if (supplier.error) return { success: false, status: 400, message: supplier.error };
    if (supplier.supplierId && supplier.supplierId === current.supplier_id) {
        return {
            success: false,
            status: 400,
            message: 'Este e-mail é do mesmo fornecedor atual. Para recomeçar com ele, use "Reenviar convite".',
        };
    }

    const token = generateToken();
    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            const ended = await assignmentModel.end(transaction, current.id, {
                endedBy: actor.id, reason: ASSIGNMENT_END_REASONS.REPLACED, comment: reason,
            });
            if (!ended) throw Object.assign(new Error('O vínculo mudou.'), { conflict: true });

            await assignmentModel.insert(transaction, {
                laborRequestId,
                supplierId: supplier.supplierId,
                inviteEmail: email,
                inviteToken: token,
                deadlineAt: deadline.value,
                createdBy: actor.id,
            });
            await laborRequestModel.updateLaborRequestStatus(
                transaction, laborRequestId, LABOR_REQUEST_STATUSES.IN_CONTRACTING, actor.id,
            );
            await auditAssignment(transaction, context, AUDIT_ACTIONS.SUPPLIER_ASSIGNMENT_REPLACE, laborRequestId,
                auditSnapshot(current),
                {
                    invite_email: email,
                    supplier: supplier.supplierName,
                    deadline_at: toLocalDateTimeText(deadline.value),
                    reason,
                });
        });
    } catch (error) {
        if (error.conflict || SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: 'O fornecedor desta solicitação mudou. Atualize a tela.' };
        }
        console.error('replaceSupplier error:', error);
        return { success: false, status: 500, message: 'Erro ao trocar o fornecedor.' };
    }

    await notifySupplierInvite({ email, request: loaded.request, token, deadlineAt: deadline.value, isNew: true });

    return {
        success: true,
        body: {
            message: supplier.supplierId
                ? `Fornecedor trocado para ${supplier.supplierName}. O anterior perdeu o acesso a esta solicitação.`
                : 'Fornecedor trocado. O novo e-mail ainda não tem cadastro: o link leva ao cadastro do fornecedor.',
            registered: Boolean(supplier.supplierId),
            inviteLink: inviteLink(token),
            mailEnabled: isMailEnabled(),
        },
    };
}
