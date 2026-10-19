import * as documentTypeModel from '../models/documentTypeModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import {
    DOCUMENT_CATEGORIES,
    DOCUMENT_CATEGORY_IDS,
    MANUAL_VALIDATION_METHOD,
    scopeForCategory,
} from '../constants/documentCategories.js';
import { changedFields, collaboratorAuditEntry } from '../utils/audit.js';
import { isBlank, toInteger } from '../utils/parse.js';

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
const VALIDITY_DAYS_MIN = 1;
const VALIDITY_DAYS_MAX = 3650;

// Código da NR: 'NR-' + 2 dígitos (normalizado para maiúsculas)
const NR_CODE_PATTERN = /^NR-\d{2}$/;
// Título que já veio com o código na frente ('NR-35 - Trabalho em Altura'): o código sai,
// senão o nome ficaria 'NR-35 - NR-35 - ...'
const NR_CODE_PREFIX_PATTERN = /^NR-\d{2}\s+-\s+/i;
// document_types.name das NRs = '<código> - <título>'
const NR_NAME_SEPARATOR = ' - ';

// Só Básico (1) e Outros (3) podem trocar de categoria entre si
const SWITCHABLE_CATEGORIES = [DOCUMENT_CATEGORIES.EMPLOYEE_BASIC, DOCUMENT_CATEGORIES.EMPLOYEE_OTHER];

// Violação de UNIQUE no SQL Server (nr_types.code e o índice único de document_types.nr_type_id)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

const DOCUMENT_TYPE_NOT_FOUND = { success: false, status: 404, message: 'Tipo de documento não encontrado.' };
const NAME_IN_USE = { success: false, status: 409, message: 'Já existe um tipo de documento com este nome.' };
const NR_ALREADY_REGISTERED = { success: false, status: 409, message: 'Essa NR já está cadastrada.' };
const NR_CODE_IN_USE = { success: false, status: 409, message: 'Já existe outra NR com este código.' };
const CATEGORY_LOCKED = { success: false, status: 400, message: 'A categoria deste tipo não pode ser alterada.' };

function badRequest(message) {
    return { success: false, status: 400, message };
}

// ─────────────────────────────────────────────
// Validação
// ─────────────────────────────────────────────

// Categoria válida (0 a 3) ou null
function parseCategory(value) {
    const category = toInteger(value);
    return DOCUMENT_CATEGORY_IDS.includes(category) ? category : null;
}

// Retorna { value } (código normalizado) ou { error }
function validateNrCode(code) {
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!NR_CODE_PATTERN.test(cleanCode)) return { error: 'Informe o código da NR no formato NR-00.' };
    return { value: cleanCode };
}

/**
 * Nome do tipo. Na NR, `name` é o título e o nome gravado é '<código> - <título>'.
 * Retorna { name, title } ou { error }.
 */
function validateName(name, nrCode = null) {
    let cleanName = typeof name === 'string' ? name.trim() : '';

    if (!nrCode) {
        if (!cleanName) return { error: 'Informe o nome.' };
        if (cleanName.length > NAME_MAX_LENGTH) return { error: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.` };
        return { name: cleanName, title: null };
    }

    cleanName = cleanName.replace(NR_CODE_PREFIX_PATTERN, '').trim();
    if (!cleanName) return { error: 'Informe o título da NR.' };

    const titleMaxLength = NAME_MAX_LENGTH - nrCode.length - NR_NAME_SEPARATOR.length;
    if (cleanName.length > titleMaxLength) {
        return { error: `O título da NR pode ter no máximo ${titleMaxLength} caracteres.` };
    }
    return { name: `${nrCode}${NR_NAME_SEPARATOR}${cleanName}`, title: cleanName };
}

// Descrição opcional. Retorna { value } (texto ou null) ou { error }
function validateDescription(description) {
    if (isBlank(description)) return { value: null };
    if (typeof description !== 'string') return { error: 'Descrição inválida.' };

    const cleanDescription = description.trim();
    if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) {
        return { error: `A descrição pode ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.` };
    }
    return { value: cleanDescription };
}

/**
 * Validade: hasExpiration (obrigatório, booleano) e o prazo padrão em dias (opcional,
 * só quando tem validade). Retorna { hasExpiration, validityDays } ou { error }.
 */
function validateExpiration(hasExpiration, validityDays) {
    if (typeof hasExpiration !== 'boolean') return { error: 'Informe se o documento tem validade.' };
    if (!hasExpiration || isBlank(validityDays)) return { hasExpiration, validityDays: null };

    const days = toInteger(validityDays);
    if (!Number.isInteger(days) || days < VALIDITY_DAYS_MIN || days > VALIDITY_DAYS_MAX) {
        return { error: `O prazo padrão deve ser de ${VALIDITY_DAYS_MIN} a ${VALIDITY_DAYS_MAX} dias.` };
    }
    return { hasExpiration, validityDays: days };
}

// ─────────────────────────────────────────────
// Auditoria
// ─────────────────────────────────────────────

// Campos do tipo de documento que entram na auditoria (code só nas NRs)
function auditSnapshot(documentType) {
    const snapshot = {
        name: documentType.name,
        description: documentType.description ?? null,
        category: documentType.category,
        has_expiration: Boolean(documentType.has_expiration),
        validity_days: documentType.validity_days ?? null,
    };
    if (documentType.category === DOCUMENT_CATEGORIES.EMPLOYEE_NR) {
        snapshot.code = documentType.code ?? null;
    }
    snapshot.is_active = Boolean(documentType.is_active);
    return snapshot;
}

function documentTypeAuditEntry(context, action, documentTypeId, oldValues, newValues) {
    return collaboratorAuditEntry(context, action, AUDIT_ENTITIES.DOCUMENT_TYPE, documentTypeId, oldValues, newValues);
}

// ─────────────────────────────────────────────
// Casos de uso
// ─────────────────────────────────────────────

export async function listDocumentTypes({ category, isActive, search = '' } = {}) {
    try {
        const result = await documentTypeModel.listDocumentTypes({ category, isActive, search });
        return { success: true, body: { message: 'Tipos de documento listados com sucesso.', result } };
    } catch (error) {
        console.error('Erro no listDocumentTypes service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os tipos de documento.' };
    }
}

/**
 * Cria um tipo de documento (ativo, validação manual, scope derivado da categoria).
 * NR (categoria 2): grava/reaproveita a NR em nr_types e liga o tipo a ela.
 */
export async function createDocumentType(payload = {}, context = {}) {
    const category = parseCategory(payload.category);
    if (category === null) return badRequest('Selecione uma categoria válida.');

    const isNr = category === DOCUMENT_CATEGORIES.EMPLOYEE_NR;

    let code = null;
    if (isNr) {
        const codeResult = validateNrCode(payload.code);
        if (codeResult.error) return badRequest(codeResult.error);
        code = codeResult.value;
    }

    const nameResult = validateName(payload.name, code);
    if (nameResult.error) return badRequest(nameResult.error);

    const descriptionResult = validateDescription(payload.description);
    if (descriptionResult.error) return badRequest(descriptionResult.error);

    const expiration = validateExpiration(payload.hasExpiration, payload.validityDays);
    if (expiration.error) return badRequest(expiration.error);

    const data = {
        name: nameResult.name,
        description: descriptionResult.value,
        category,
        scope: scopeForCategory(category),
        validationMethod: MANUAL_VALIDATION_METHOD,
        hasExpiration: expiration.hasExpiration,
        validityDays: expiration.validityDays,
    };

    try {
        // NR já cadastrada em nr_types: sem tipo de documento, é reaproveitada; com tipo, é repetida
        let existingNr = null;
        if (isNr) {
            existingNr = await documentTypeModel.getNrTypeByCode(code);
            if (existingNr?.document_type_id) return NR_ALREADY_REGISTERED;
        }

        if (await documentTypeModel.documentTypeNameInUse(data.name)) return NAME_IN_USE;

        // NR, tipo de documento e auditoria na mesma transação
        const id = await trasaction.executarEmTransacao(async (transaction) => {
            let nrTypeId = null;
            if (isNr) {
                const nrData = { code, name: nameResult.title, description: data.description };
                if (existingNr) {
                    await documentTypeModel.updateNrType(transaction, existingNr.id, nrData);
                    nrTypeId = existingNr.id;
                } else {
                    nrTypeId = await documentTypeModel.insertNrType(transaction, nrData);
                }
            }

            const newId = await documentTypeModel.insertDocumentType(transaction, { ...data, nrTypeId });
            await auditModel.insertAuditLog(transaction, documentTypeAuditEntry(
                context,
                AUDIT_ACTIONS.DOCUMENT_TYPE_CREATE,
                newId,
                null,
                auditSnapshot({
                    name: data.name,
                    description: data.description,
                    category,
                    has_expiration: data.hasExpiration,
                    validity_days: data.validityDays,
                    code,
                    is_active: true,
                }),
            ));
            return newId;
        });

        const documentType = await documentTypeModel.getDocumentTypeById(id);
        console.log(`Tipo de documento ${id} criado.`);
        return { success: true, body: { message: 'Tipo de documento criado com sucesso.', documentType } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return isNr ? NR_ALREADY_REGISTERED : NAME_IN_USE;
        console.error('Erro no createDocumentType service:', error);
        return { success: false, status: 500, message: 'Erro ao criar o tipo de documento.' };
    }
}

/**
 * Edita um tipo de documento. A categoria só troca entre Básico (1) e Outros (3).
 * Na NR, título e código podem mudar: nr_types acompanha e o nome é recomposto.
 * Campos opcionais que não vierem (description, validityDays, category, code) ficam como estão.
 * Não altera validation_method nem api_endpoint.
 */
export async function updateDocumentType(id, payload = {}, context = {}) {
    try {
        const before = await documentTypeModel.getDocumentTypeById(id);
        if (!before) return DOCUMENT_TYPE_NOT_FOUND;

        let category = before.category;
        if (!isBlank(payload.category)) {
            const requestedCategory = parseCategory(payload.category);
            if (requestedCategory === null) return badRequest('Selecione uma categoria válida.');

            if (requestedCategory !== before.category) {
                const canSwitch = SWITCHABLE_CATEGORIES.includes(before.category)
                    && SWITCHABLE_CATEGORIES.includes(requestedCategory);
                if (!canSwitch) return CATEGORY_LOCKED;
                category = requestedCategory;
            }
        }

        const isNr = category === DOCUMENT_CATEGORIES.EMPLOYEE_NR;

        let code = null;
        if (isNr) {
            if (payload.code === undefined || payload.code === null) {
                code = before.code;
            } else {
                const codeResult = validateNrCode(payload.code);
                if (codeResult.error) return badRequest(codeResult.error);
                code = codeResult.value;
            }
        }

        const nameResult = validateName(payload.name, code);
        if (nameResult.error) return badRequest(nameResult.error);

        let description = before.description ?? null;
        if (payload.description !== undefined) {
            const descriptionResult = validateDescription(payload.description);
            if (descriptionResult.error) return badRequest(descriptionResult.error);
            description = descriptionResult.value;
        }

        const validityDaysInput = payload.validityDays === undefined ? before.validity_days : payload.validityDays;
        const expiration = validateExpiration(payload.hasExpiration, validityDaysInput);
        if (expiration.error) return badRequest(expiration.error);

        const after = {
            name: nameResult.name,
            description,
            category,
            has_expiration: expiration.hasExpiration,
            validity_days: expiration.validityDays,
            code,
            is_active: before.is_active,
        };

        const changes = changedFields(auditSnapshot(before), auditSnapshot(after));
        if (!changes) {
            return { success: true, body: { message: 'Nenhuma alteração para salvar.', documentType: before } };
        }

        if (after.name !== before.name && await documentTypeModel.documentTypeNameInUse(after.name, id)) {
            return NAME_IN_USE;
        }

        if (isNr && code !== before.code) {
            const nrWithCode = await documentTypeModel.getNrTypeByCode(code);
            if (nrWithCode && nrWithCode.id !== before.nr_type_id) return NR_CODE_IN_USE;
        }

        await trasaction.executarEmTransacao(async (transaction) => {
            if (isNr) {
                await documentTypeModel.updateNrType(transaction, before.nr_type_id, {
                    code,
                    name: nameResult.title,
                    description,
                });
            }

            await documentTypeModel.updateDocumentType(transaction, id, {
                name: after.name,
                description,
                category,
                scope: scopeForCategory(category),
                hasExpiration: after.has_expiration,
                validityDays: after.validity_days,
            });

            await auditModel.insertAuditLog(transaction, documentTypeAuditEntry(
                context, AUDIT_ACTIONS.DOCUMENT_TYPE_UPDATE, id, changes.oldValues, changes.newValues,
            ));
        });

        const documentType = await documentTypeModel.getDocumentTypeById(id);
        console.log(`Tipo de documento ${id} atualizado.`);
        return { success: true, body: { message: 'Tipo de documento atualizado com sucesso.', documentType } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return NR_CODE_IN_USE;
        console.error('Erro no updateDocumentType service:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar o tipo de documento.' };
    }
}

/**
 * Ativa ou inativa um tipo de documento (idempotente: só grava e audita se mudou).
 * Inativo some das listas de exigência e das sugestões; os documentos já enviados ficam.
 */
export async function setDocumentTypeStatus(id, isActive, context = {}) {
    if (typeof isActive !== 'boolean') {
        return badRequest('Informe se o tipo de documento fica ativo (true) ou inativo (false).');
    }

    try {
        const before = await documentTypeModel.getDocumentTypeById(id);
        if (!before) return DOCUMENT_TYPE_NOT_FOUND;

        if (Boolean(before.is_active) !== isActive) {
            await trasaction.executarEmTransacao(async (transaction) => {
                await documentTypeModel.setDocumentTypeActive(transaction, id, isActive);
                await auditModel.insertAuditLog(transaction, documentTypeAuditEntry(
                    context,
                    isActive ? AUDIT_ACTIONS.DOCUMENT_TYPE_ACTIVATE : AUDIT_ACTIONS.DOCUMENT_TYPE_INACTIVATE,
                    id,
                    { is_active: !isActive },
                    { is_active: isActive },
                ));
            });
            console.log(`Tipo de documento ${id} ${isActive ? 'ativado' : 'inativado'}.`);
        }

        const documentType = await documentTypeModel.getDocumentTypeById(id);
        return {
            success: true,
            body: { message: isActive ? 'Tipo de documento ativado.' : 'Tipo de documento inativado.', documentType },
        };
    } catch (error) {
        console.error('Erro no setDocumentTypeStatus service:', error);
        return { success: false, status: 500, message: 'Erro ao alterar o status do tipo de documento.' };
    }
}
