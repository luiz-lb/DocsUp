import bcrypt from 'bcrypt';
import * as userModel from '../models/userModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { DEPARTMENTS } from '../constants/departments.js';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_ENTITIES } from '../constants/audit.js';
import { getPasswordPolicyError } from '../utils/passwordPolicy.js';

const ADMIN_ROLE = 'ADMIN';
const ADMIN_NAME = 'Administrador';

// Hash bcrypt completo ($2a$, $2b$ ou $2y$ + custo + 53 caracteres)
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Violação de UNIQUE/PK no SQL Server (outra instância criou o mesmo e-mail ao mesmo tempo)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

/**
 * Converte SENHA_ADMIN em hash bcrypt.
 * Aceita a senha em texto (gera o hash) ou um hash bcrypt pronto (grava como está),
 * para o .env não precisar guardar a senha em texto.
 * Retorna { passwordHash } ou { error }.
 */
async function resolveAdminPasswordHash(value) {
    if (BCRYPT_HASH.test(value)) {
        // $2y$ (PHP/htpasswd) é o mesmo algoritmo do $2b$, que é o que o bcrypt do Node lê
        return { passwordHash: value.startsWith('$2y$') ? '$2b$' + value.slice(4) : value };
    }

    if (/^\$2[aby]\$/.test(value)) {
        return {
            error: 'SENHA_ADMIN parece um hash bcrypt incompleto. No .env do docker compose, '
                + "coloque o hash entre aspas simples (SENHA_ADMIN='$2b$...'), senão o $ é lido como variável.",
        };
    }

    const policyError = getPasswordPolicyError(value);
    if (policyError) {
        return { error: `SENHA_ADMIN inválida: ${policyError}` };
    }

    return { passwordHash: await bcrypt.hash(value, 10) };
}

/**
 * Cria o usuário Admin inicial a partir de USER_ADMIN (e-mail) e SENHA_ADMIN
 * (senha em texto ou hash bcrypt).
 *
 * Idempotente: se já existe usuário com esse e-mail (ativo ou não), não faz nada.
 * Em especial, NÃO redefine a senha: trocar SENHA_ADMIN depois não altera o Admin.
 */
export async function ensureInitialAdmin() {
    const email = process.env.USER_ADMIN?.trim();
    const password = process.env.SENHA_ADMIN;

    if (!email || !password) {
        console.log('[Bootstrap] USER_ADMIN/SENHA_ADMIN não definidos: Admin inicial não será criado.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
        console.error('[Bootstrap] USER_ADMIN precisa ser um e-mail válido: Admin inicial não criado.');
        return;
    }

    const existingId = await userModel.getUserIdByEmail(email);
    if (existingId) {
        console.log('[Bootstrap] Admin inicial já existe: nada a fazer.');
        return;
    }

    const { passwordHash, error } = await resolveAdminPasswordHash(password);
    if (error) {
        console.error(`[Bootstrap] ${error} Admin inicial não criado.`);
        return;
    }

    try {
        // Admin e auditoria (autor: o próprio sistema) na mesma transação
        const id = await trasaction.executarEmTransacao(async (transaction) => {
            const newId = await userModel.insertUser(transaction, {
                name: ADMIN_NAME,
                email,
                department: DEPARTMENTS.ADMIN,
                role: ADMIN_ROLE,
                passwordHash,
            });
            await auditModel.insertAuditLog(transaction, {
                actorType: AUDIT_ACTOR_TYPES.SYSTEM,
                actorId: null,
                action: AUDIT_ACTIONS.USER_CREATE,
                entityType: AUDIT_ENTITIES.USER,
                entityId: newId,
                oldValues: null,
                newValues: { name: ADMIN_NAME, email, department: DEPARTMENTS.ADMIN, is_active: true },
            });
            return newId;
        });
        console.log(`[Bootstrap] Admin inicial criado (id ${id}).`);
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            console.log('[Bootstrap] Admin inicial já foi criado por outra instância.');
            return;
        }
        throw error;
    }
}
