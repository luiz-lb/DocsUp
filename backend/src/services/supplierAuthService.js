import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import * as supplierModel from '../models/supplierModel.js';
import * as supplierUserModel from '../models/supplierUserModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { getSupplierJwtSecret } from '../config/jwtSecrets.js';
import { sendMail, escapeHtml } from './mailService.js';
import { cnpjDigits, formatCnpj, isValidCnpj } from '../utils/cnpj.js';
import { normalizeEmail } from '../utils/email.js';
import { getPasswordPolicyError } from '../utils/passwordPolicy.js';
import { SUPPLIER_STATUSES, SUPPLIER_USER_ROLES, SUPPLIER_USER_ROLE_LABELS } from '../constants/supplierUsers.js';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_ENTITIES } from '../constants/audit.js';

const NAME_MAX_LENGTH = 200;
const COMPANY_NAME_MAX_LENGTH = 300;
const OTP_TTL_MS = 10 * 60 * 1000;   // código vale 10 minutos
const OTP_MAX_ATTEMPTS = 5;          // depois disso, volta para o login
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';
const EMAIL_IN_USE = 'Este e-mail já tem cadastro no portal. Use outro e-mail.';

// Comparação com hash fictício quando o e-mail não existe: o tempo de resposta do login não
// revela se o e-mail tem cadastro
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Gera OTP numérico de 6 dígitos */
function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

/**
 * Emite o JWT de fornecedor (tipo separado do JWT de colaborador). Leva o usuário que entrou;
 * os dados do fornecedor são relidos do banco a cada requisição (verificarTokenFornecedor).
 */
function signSupplierToken(user) {
    return jwt.sign(
        { type: 'supplier', supplierId: user.supplier_id, supplierUserId: user.id, role: user.role },
        getSupplierJwtSecret(),
        { expiresIn: '4h' },
    );
}

/** Texto obrigatório (ou opcional), sem espaços nas pontas e com limite. Retorna { value } ou { error }. */
function cleanText(value, { label, max, required = true }) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return required ? { error: `Informe ${label}.` } : { value: null };
    if (text.length > max) return { error: `${label[0].toUpperCase()}${label.slice(1)} pode ter no máximo ${max} caracteres.` };
    return { value: text };
}

/** Nome e e-mail de um usuário do cadastro. Retorna { name, email } ou { error }. */
function resolveUserData(data, roleLabel) {
    const name = cleanText(data?.name, { label: `o nome do ${roleLabel}`, max: NAME_MAX_LENGTH });
    if (name.error) return { error: name.error };
    const email = normalizeEmail(data?.email);
    if (!email) return { error: `Informe um e-mail válido para o ${roleLabel}.` };
    return { name: name.value, email };
}

/** Usuário como a tela vê (sem hash nem controle de sessão). */
function publicUser(user) {
    return {
        id: user.id,
        role: user.role,
        roleLabel: SUPPLIER_USER_ROLE_LABELS[user.role] ?? '',
        name: user.name,
        email: user.email,
    };
}

/** Dados da sessão do fornecedor (resposta do login e do /me). */
export function sessionPayload(user) {
    return {
        supplierId: user.supplier_id,
        cnpj: user.cnpj,
        razaoSocial: user.razao_social,
        nomeFantasia: user.nome_fantasia,
        user: publicUser(user),
    };
}

/** Registro de auditoria de uma ação do fornecedor (autor: o fornecedor). */
function supplierAuditEntry(context, supplierId, action, entityId, oldValues, newValues) {
    return {
        actorType: AUDIT_ACTOR_TYPES.SUPPLIER,
        actorId: supplierId,
        action,
        entityType: AUDIT_ENTITIES.SUPPLIER_USER,
        entityId,
        oldValues,
        newValues,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
    };
}

/** Instante atual alinhado ao segundo (o iat do JWT tem precisão de segundo). */
function nowToTheSecond() {
    return new Date(Math.floor(Date.now() / 1000) * 1000);
}

// ─────────────────────────────────────────────
// Validação de CNPJ via API pública (ReceitaWS)
// ─────────────────────────────────────────────

/**
 * Confere os dígitos do CNPJ e consulta a ReceitaWS para preencher a razão social.
 * Retorna { valid, alreadyRegistered, razaoSocial, nomeFantasia, situacao }.
 * Se a API externa falhar, o CNPJ (com dígitos certos) continua válido, sem dados.
 */
export async function validateCnpjPublicApi(cnpj) {
    const digits = cnpjDigits(cnpj);
    if (!isValidCnpj(digits)) {
        return { valid: false, alreadyRegistered: false, razaoSocial: null, nomeFantasia: null, situacao: null };
    }

    const alreadyRegistered = await supplierModel.supplierExistsByCnpj(formatCnpj(digits));

    try {
        const { data } = await axios.get(`https://receitaws.com.br/v1/cnpj/${digits}`, { timeout: 8000 });
        if (data.status === 'ERROR') {
            return { valid: false, alreadyRegistered, razaoSocial: null, nomeFantasia: null, situacao: null };
        }
        return {
            valid: true,
            alreadyRegistered,
            razaoSocial: data.nome ?? null,
            nomeFantasia: data.fantasia || null,
            situacao: data.situacao ?? null,
        };
    } catch (error) {
        console.error('validateCnpjPublicApi error:', error.message);
        return { valid: true, alreadyRegistered, razaoSocial: null, nomeFantasia: null, situacao: 'DESCONHECIDO' };
    }
}

// ─────────────────────────────────────────────
// Cadastro do fornecedor
// ─────────────────────────────────────────────

/**
 * Cadastro simplificado: CNPJ, razão social (nome fantasia opcional), os dois usuários
 * (Responsável e Operador, com nome e e-mail, e-mails diferentes) e a senha. A senha do
 * cadastro é a senha inicial dos dois; cada um troca a sua depois, no Perfil.
 *
 * Payload: { cnpj, razaoSocial, nomeFantasia?, owner: { name, email },
 *            operator: { name, email }, password }
 * Retorna { success, supplierId } ou { success: false, status, message }.
 */
export async function registerSupplier(payload = {}) {
    const digits = cnpjDigits(payload.cnpj);
    if (!isValidCnpj(digits)) {
        return { success: false, status: 400, message: 'CNPJ inválido. Confira os dígitos.' };
    }

    const razaoSocial = cleanText(payload.razaoSocial, { label: 'a razão social', max: COMPANY_NAME_MAX_LENGTH });
    if (razaoSocial.error) return { success: false, status: 400, message: razaoSocial.error };
    const nomeFantasia = cleanText(payload.nomeFantasia, { label: 'o nome fantasia', max: COMPANY_NAME_MAX_LENGTH, required: false });
    if (nomeFantasia.error) return { success: false, status: 400, message: nomeFantasia.error };

    const owner = resolveUserData(payload.owner, 'Responsável');
    if (owner.error) return { success: false, status: 400, message: owner.error };
    const operator = resolveUserData(payload.operator, 'Operador');
    if (operator.error) return { success: false, status: 400, message: operator.error };
    if (owner.email === operator.email) {
        return { success: false, status: 400, message: 'O Responsável e o Operador precisam ter e-mails diferentes.' };
    }

    const passwordError = getPasswordPolicyError(payload.password);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    const cnpj = formatCnpj(digits);
    if (await supplierModel.supplierExistsByCnpj(cnpj)) {
        return {
            success: false,
            status: 409,
            message: 'CNPJ já cadastrado. Entre com o e-mail do Responsável ou do Operador.',
        };
    }
    for (const user of [owner, operator]) {
        if (await supplierUserModel.emailInUse(user.email)) {
            return { success: false, status: 409, message: `O e-mail ${user.email} já tem cadastro no portal. Use outro e-mail ou entre com ele.` };
        }
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    try {
        const supplierId = await trasaction.executarEmTransacao(async (transaction) => {
            const id = await supplierModel.insertSupplier(transaction, {
                cnpj,
                razaoSocial: razaoSocial.value,
                nomeFantasia: nomeFantasia.value,
            });
            if (!id) throw new Error('Fornecedor não foi criado.');

            await supplierUserModel.insertUser(transaction, {
                supplierId: id, role: SUPPLIER_USER_ROLES.OWNER, name: owner.name, email: owner.email, passwordHash,
            });
            await supplierUserModel.insertUser(transaction, {
                supplierId: id, role: SUPPLIER_USER_ROLES.OPERATOR, name: operator.name, email: operator.email, passwordHash,
            });
            return id;
        });

        console.log(`Fornecedor cadastrado: CNPJ ${cnpj}, ID ${supplierId}.`);
        return { success: true, supplierId };
    } catch (error) {
        // Dois cadastros ao mesmo tempo com o mesmo CNPJ ou e-mail
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: 'CNPJ ou e-mail já cadastrado.' };
        }
        console.error('registerSupplier error:', error);
        return { success: false, status: 500, message: 'Erro interno ao cadastrar o fornecedor.' };
    }
}

// ─────────────────────────────────────────────
// Perfil do fornecedor (tela de Perfil no portal)
// ─────────────────────────────────────────────

/**
 * Dados da empresa e os dois usuários. `currentUserId` diz quem está logado.
 */
export async function getSupplierProfile(supplierId, currentUserId) {
    try {
        const supplier = await supplierModel.getSupplierProfile(supplierId);
        if (!supplier) {
            return { success: false, status: 404, message: 'Fornecedor não encontrado.' };
        }
        const users = await supplierUserModel.listUsersBySupplier(supplierId);
        return {
            success: true,
            body: {
                supplier: {
                    id: supplier.id,
                    cnpj: supplier.cnpj,
                    razao_social: supplier.razao_social,
                    nome_fantasia: supplier.nome_fantasia,
                    status: supplier.status,
                },
                users: users.map(publicUser),
                currentUserId,
            },
        };
    } catch (error) {
        console.error('getSupplierProfile error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar o perfil.' };
    }
}

/**
 * Nome fantasia da empresa (só o Responsável altera; CNPJ e razão social ficam fixos).
 * @param {{ supplierId, supplierUserId, role }} actor — fornecedor logado
 */
export async function updateCompany(actor, payload = {}) {
    if (actor.role !== SUPPLIER_USER_ROLES.OWNER) {
        return { success: false, status: 403, message: 'Só o Responsável altera os dados da empresa.' };
    }
    const nomeFantasia = cleanText(payload.nomeFantasia, { label: 'o nome fantasia', max: COMPANY_NAME_MAX_LENGTH, required: false });
    if (nomeFantasia.error) return { success: false, status: 400, message: nomeFantasia.error };

    try {
        await trasaction.executarEmTransacao((transaction) =>
            supplierModel.updateCompany(transaction, actor.supplierId, { nomeFantasia: nomeFantasia.value }));
        return { success: true, body: { message: 'Dados da empresa atualizados.' } };
    } catch (error) {
        console.error('updateCompany error:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar os dados da empresa.' };
    }
}

/**
 * Edita nome e e-mail de um usuário do fornecedor. Cada usuário edita os próprios dados; o
 * Responsável também edita os do Operador e pode definir uma nova senha para ele (ex.: o
 * Operador mudou de pessoa). Nova senha definida pelo Responsável encerra as sessões do Operador.
 *
 * @param {{ supplierId, supplierUserId, role }} actor
 * @param {number} targetUserId
 * @param {{ name, email, password? }} payload
 * @param {{ ipAddress, userAgent }} context
 */
export async function updateSupplierUser(actor, targetUserId, payload = {}, context = {}) {
    const target = await supplierUserModel.getUserById(targetUserId);
    if (!target || target.supplier_id !== actor.supplierId) {
        return { success: false, status: 404, message: 'Usuário não encontrado.' };
    }
    const isSelf = target.id === actor.supplierUserId;
    if (!isSelf && actor.role !== SUPPLIER_USER_ROLES.OWNER) {
        return { success: false, status: 403, message: 'Você só pode alterar os seus próprios dados.' };
    }

    const roleLabel = SUPPLIER_USER_ROLE_LABELS[target.role] ?? 'usuário';
    const data = resolveUserData(payload, roleLabel);
    if (data.error) return { success: false, status: 400, message: data.error };

    const hasNewPassword = typeof payload.password === 'string' && payload.password !== '';
    if (hasNewPassword && isSelf) {
        return { success: false, status: 400, message: 'Para trocar a sua senha, use "Trocar senha".' };
    }
    if (hasNewPassword) {
        const passwordError = getPasswordPolicyError(payload.password);
        if (passwordError) return { success: false, status: 400, message: passwordError };
    }

    if (data.email !== target.email && await supplierUserModel.emailInUse(data.email, target.id)) {
        return { success: false, status: 409, message: EMAIL_IN_USE };
    }

    const oldValues = { name: target.name, email: target.email };
    const newValues = { name: data.name, email: data.email };
    const changed = oldValues.name !== newValues.name || oldValues.email !== newValues.email;
    if (!changed && !hasNewPassword) {
        return { success: true, body: { message: 'Nenhuma alteração para salvar.' } };
    }

    const passwordHash = hasNewPassword ? await bcrypt.hash(payload.password, 12) : null;

    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            if (changed) {
                await supplierUserModel.updateUser(transaction, target.id, data);
                await auditModel.insertAuditLog(transaction, supplierAuditEntry(
                    context, actor.supplierId, AUDIT_ACTIONS.SUPPLIER_USER_UPDATE, target.id,
                    { ...oldValues, role: target.role }, { ...newValues, role: target.role },
                ));
            }
            if (hasNewPassword) {
                await supplierUserModel.updatePassword(transaction, target.id, passwordHash, nowToTheSecond());
                await auditModel.insertAuditLog(transaction, supplierAuditEntry(
                    context, actor.supplierId, AUDIT_ACTIONS.SUPPLIER_USER_PASSWORD_CHANGE, target.id,
                    null, { role: target.role, by_owner: true },
                ));
            }
        });
        return { success: true, body: { message: `Dados do ${roleLabel} atualizados.` } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: EMAIL_IN_USE };
        }
        console.error('updateSupplierUser error:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar o usuário.' };
    }
}

/**
 * Cadastra o usuário que falta (Responsável ou Operador). Acontece com fornecedores antigos:
 * na migração, um contato sem e-mail ou com e-mail repetido não virou usuário. Qualquer
 * usuário da empresa pode cadastrar o que falta, com nome, e-mail e senha inicial.
 *
 * @param {{ supplierId }} actor
 * @param {{ role, name, email, password }} payload
 */
export async function createMissingUser(actor, payload = {}, context = {}) {
    const role = Number(payload.role);
    if (![SUPPLIER_USER_ROLES.OWNER, SUPPLIER_USER_ROLES.OPERATOR].includes(role)) {
        return { success: false, status: 400, message: 'Escolha Responsável ou Operador.' };
    }
    const roleLabel = SUPPLIER_USER_ROLE_LABELS[role];

    const users = await supplierUserModel.listUsersBySupplier(actor.supplierId);
    if (users.some((user) => user.role === role)) {
        return { success: false, status: 409, message: `A empresa já tem um ${roleLabel}.` };
    }

    const data = resolveUserData(payload, roleLabel);
    if (data.error) return { success: false, status: 400, message: data.error };
    const passwordError = getPasswordPolicyError(payload.password);
    if (passwordError) return { success: false, status: 400, message: passwordError };
    if (await supplierUserModel.emailInUse(data.email)) {
        return { success: false, status: 409, message: EMAIL_IN_USE };
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            const userId = await supplierUserModel.insertUser(transaction, {
                supplierId: actor.supplierId, role, name: data.name, email: data.email, passwordHash,
            });
            await auditModel.insertAuditLog(transaction, supplierAuditEntry(
                context, actor.supplierId, AUDIT_ACTIONS.SUPPLIER_USER_CREATE, userId,
                null, { role, name: data.name, email: data.email },
            ));
        });
        return { success: true, body: { message: `${roleLabel} cadastrado.` } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            return { success: false, status: 409, message: 'Este e-mail ou papel já foi cadastrado.' };
        }
        console.error('createMissingUser error:', error);
        return { success: false, status: 500, message: 'Erro ao cadastrar o usuário.' };
    }
}

/**
 * O usuário logado troca a própria senha (confere a senha atual). Encerra as outras
 * sessões dele; quem chama reemite o cookie desta sessão (token devolvido).
 */
export async function changeOwnPassword(actor, payload = {}, context = {}) {
    const { currentPassword, newPassword } = payload;
    if (typeof currentPassword !== 'string' || !currentPassword) {
        return { success: false, status: 400, message: 'Informe a senha atual.' };
    }
    const passwordError = getPasswordPolicyError(newPassword);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    const currentHash = await supplierUserModel.getPasswordHash(actor.supplierUserId);
    if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
        return { success: false, status: 400, message: 'A senha atual não confere.' };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const validAfter = nowToTheSecond();

    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            await supplierUserModel.updatePassword(transaction, actor.supplierUserId, passwordHash, validAfter);
            await auditModel.insertAuditLog(transaction, supplierAuditEntry(
                context, actor.supplierId, AUDIT_ACTIONS.SUPPLIER_USER_PASSWORD_CHANGE, actor.supplierUserId,
                null, { role: actor.role, by_owner: false },
            ));
        });

        // Nova sessão para quem trocou (as anteriores a validAfter deixam de valer)
        const user = await supplierUserModel.getUserById(actor.supplierUserId);
        return { success: true, token: signSupplierToken(user), body: { message: 'Senha alterada.' } };
    } catch (error) {
        console.error('changeOwnPassword error:', error);
        return { success: false, status: 500, message: 'Erro ao trocar a senha.' };
    }
}

// ─────────────────────────────────────────────
// Login — Fase 1: e-mail + senha → código por e-mail
// ─────────────────────────────────────────────

/**
 * Fase 1 do login: confere e-mail e senha do usuário e envia o código (OTP) para o e-mail
 * dele. O hash do código fica na sessão (express-session), com validade e tentativas.
 *
 * @param {string} email
 * @param {string} password
 * @param {object} session — req.session do Express
 */
export async function loginPhase1(email, password, session) {
    const normalized = normalizeEmail(email);
    if (!normalized || typeof password !== 'string' || !password) {
        return { success: false, status: 400, message: 'Informe o e-mail e a senha.' };
    }

    const user = await supplierUserModel.getUserForLogin(normalized);
    const passwordMatch = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatch || !user.is_active) {
        return { success: false, status: 401, message: INVALID_CREDENTIALS };
    }
    if (user.supplier_status === SUPPLIER_STATUSES.BLOCKED) {
        return { success: false, status: 403, message: 'Fornecedor bloqueado. Entre em contato com Suprimentos.' };
    }
    if (user.supplier_status === SUPPLIER_STATUSES.INACTIVE) {
        return { success: false, status: 403, message: 'Fornecedor inativo. Entre em contato com Suprimentos.' };
    }

    // Gera o código e guarda só o hash na sessão (nunca o código em texto)
    const otp = generateOtp();
    session.mfaPending = {
        supplierUserId: user.id,
        otpHash: await bcrypt.hash(otp, 8),
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
    };

    const sent = await sendMail({
        to: user.email,
        subject: 'Seu código de acesso ao Portal do Fornecedor',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
                <h2 style="color: #004643;">Portal do Fornecedor</h2>
                <p>Olá, ${escapeHtml(user.name)}. Um acesso foi solicitado para ${escapeHtml(user.razao_social)}.</p>
                <p>Seu código de verificação é:</p>
                <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.3em;
                            background: #f3f4f6; padding: 1rem 2rem;
                            border-radius: 8px; text-align: center; margin: 1rem 0;">
                    ${otp}
                </div>
                <p style="color: #6b7280; font-size: 0.875rem;">
                    Este código expira em 10 minutos. Se não foi você, ignore este e-mail.
                </p>
            </div>
        `,
    });

    if (!sent && process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Código de acesso para ${user.email}: ${otp}`);
    }

    return {
        success: true,
        requiresMfa: true,
        // Fora de produção o código volta na resposta (para testar sem SMTP)
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    };
}

// ─────────────────────────────────────────────
// Login — Fase 2: confere o código e emite o JWT
// ─────────────────────────────────────────────

/**
 * Fase 2 do login: confere o código (até 5 tentativas, dentro da validade) e emite o JWT.
 *
 * @param {string} otp
 * @param {object} session — req.session do Express
 */
export async function loginPhase2(otp, session) {
    const pending = session.mfaPending;
    if (!pending?.supplierUserId) {
        return { success: false, message: 'Sessão de verificação não iniciada. Faça login novamente.' };
    }

    if (Date.now() > pending.expiresAt) {
        delete session.mfaPending;
        return { success: false, message: 'Código expirado. Faça login novamente.' };
    }

    const otpMatch = typeof otp === 'string' && /^\d{6}$/.test(otp) && await bcrypt.compare(otp, pending.otpHash);
    if (!otpMatch) {
        pending.attempts = (pending.attempts ?? 0) + 1;
        if (pending.attempts >= OTP_MAX_ATTEMPTS) {
            delete session.mfaPending;
            return { success: false, message: 'Muitas tentativas com código errado. Faça login novamente.' };
        }
        return { success: false, message: 'Código inválido.' };
    }

    delete session.mfaPending;

    const user = await supplierUserModel.getUserById(pending.supplierUserId);
    if (!user || !user.is_active
        || [SUPPLIER_STATUSES.INACTIVE, SUPPLIER_STATUSES.BLOCKED].includes(user.supplier_status)) {
        return { success: false, message: 'Acesso não permitido. Entre em contato com Suprimentos.' };
    }

    // O código chegou no e-mail: ele está confirmado (passa a receber convites direto)
    if (!user.email_verified_at) await supplierUserModel.markEmailVerified(user.id);

    return { success: true, token: signSupplierToken(user), supplier: sessionPayload(user) };
}
