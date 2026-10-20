import fs from 'fs';
import path from 'path';
import * as documentFileModel from '../models/documentFileModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { toInteger } from '../utils/parse.js';
import { resolveUploadPath } from '../utils/uploadPaths.js';

// Máximo de documentos num ZIP (acima disso, o download fica pesado demais para uma requisição)
export const MAX_ZIP_DOCUMENTS = 500;

// Lista dos arquivos que não estavam no servidor, gravada dentro do ZIP
const MISSING_FILES_NAME = 'arquivos-nao-encontrados.txt';

const DOCUMENT_NOT_FOUND = { success: false, status: 404, message: 'Documento não encontrado.' };
const FILE_NOT_FOUND = { success: false, status: 404, message: 'O arquivo deste documento não foi encontrado no servidor.' };

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Caminho absoluto do arquivo, ou null se estiver fora da pasta de uploads ou não existir. */
function existingFilePath(document) {
    const absolutePath = resolveUploadPath(document.file_path);
    if (!absolutePath) return null;
    try {
        return fs.statSync(absolutePath).isFile() ? absolutePath : null;
    } catch {
        return null;
    }
}

/**
 * Trecho de caminho seguro para o ZIP (pasta ou arquivo): sem caracteres que o Windows
 * não aceita, sem barras (não cria pastas a mais) e com tamanho limitado.
 */
function safeName(value, fallback, maxLength = 80) {
    const clean = String(value ?? '')
        .normalize('NFC')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f<>:"/\\|?*]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '');
    return (clean || fallback).slice(0, maxLength).trim();
}

/** Nome do arquivo no ZIP: '<tipo> - <nome original>', mantendo a extensão. */
function zipFileName(document) {
    const extension = safeName(path.extname(document.file_name ?? ''), '', 10);
    const originalBase = path.basename(document.file_name ?? 'arquivo', path.extname(document.file_name ?? ''));
    const base = safeName(`${document.document_type_name} - ${originalBase}`, `Documento ${document.id}`, 150);
    return `${base}${extension}`;
}

/**
 * Pasta do documento no ZIP:
 *   <Fornecedor>/<Solicitação N - Título>/Empresa/
 *   <Fornecedor>/<Solicitação N - Título>/Colaboradores/<Nome do colaborador>/
 */
function zipFolder(document) {
    const supplier = safeName(document.supplier_name, `Fornecedor ${document.supplier_id}`);
    const request = document.labor_request_id
        ? safeName(`Solicitação ${document.labor_request_id} - ${document.labor_request_title ?? ''}`, `Solicitação ${document.labor_request_id}`)
        : 'Sem solicitação';
    if (!document.employee_id) return `${supplier}/${request}/Empresa`;
    const employee = safeName(document.employee_name, `Colaborador ${document.employee_id}`);
    return `${supplier}/${request}/Colaboradores/${employee}`;
}

/** Caminho único no ZIP: repetido ganha ' (2)', ' (3)'... antes da extensão. */
function uniquePath(fullPath, usedPaths) {
    let candidate = fullPath;
    const extension = path.posix.extname(fullPath);
    const base = fullPath.slice(0, fullPath.length - extension.length);
    for (let copy = 2; usedPaths.has(candidate.toLowerCase()); copy += 1) {
        candidate = `${base} (${copy})${extension}`;
    }
    usedPaths.add(candidate.toLowerCase());
    return candidate;
}

/** documentos-AAAA-MM-DD-HHmm.zip (horário local). */
function zipArchiveName(date = new Date()) {
    const pad = (number) => String(number).padStart(2, '0');
    return `documentos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`;
}

async function auditDownload(context, action, documentId, newValues) {
    await trasaction.executarEmTransacao(async (transaction) => {
        await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
            context, action, AUDIT_ENTITIES.DOCUMENT, documentId, null, newValues,
        ));
    });
}

// ─────────────────────────────────────────────
// Casos de uso
// ─────────────────────────────────────────────

/**
 * Um documento: confere o registro e o arquivo, registra na auditoria e devolve
 * o que o controller precisa para enviar ({ absolutePath, fileName }).
 */
export async function prepareDocumentDownload(documentId, context = {}) {
    try {
        const [document] = await documentFileModel.getDocumentFilesByIds([documentId]);
        if (!document) return DOCUMENT_NOT_FOUND;

        const absolutePath = existingFilePath(document);
        if (!absolutePath) {
            console.warn(`Download: arquivo do documento ${documentId} não encontrado no servidor.`);
            return FILE_NOT_FOUND;
        }

        await auditDownload(context, AUDIT_ACTIONS.DOCUMENT_DOWNLOAD, document.id, {
            file_name: document.file_name,
            document_type: document.document_type_name,
            supplier: document.supplier_name,
            employee: document.employee_name ?? null,
        });

        return {
            success: true,
            body: {
                absolutePath,
                fileName: document.file_name || `documento-${document.id}${path.extname(absolutePath)}`,
            },
        };
    } catch (error) {
        console.error('Erro no prepareDocumentDownload service:', error);
        return { success: false, status: 500, message: 'Erro ao preparar o download do documento.' };
    }
}

/**
 * Vários documentos em um ZIP: valida os ids, monta o nome de cada arquivo dentro do
 * ZIP, separa os que não estão no servidor e registra um único item na auditoria.
 * Devolve { zipName, entries: [{ absolutePath, name }], missingText } para o controller.
 */
export async function prepareZipDownload(documentIds, context = {}) {
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return { success: false, status: 400, message: 'Selecione ao menos um documento para baixar.' };
    }

    const ids = documentIds.map(toInteger);
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        return { success: false, status: 400, message: 'Documento inválido.' };
    }
    const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
    if (uniqueIds.length > MAX_ZIP_DOCUMENTS) {
        return { success: false, status: 400, message: `Selecione no máximo ${MAX_ZIP_DOCUMENTS} documentos por vez.` };
    }

    try {
        const documents = await documentFileModel.getDocumentFilesByIds(uniqueIds);
        if (documents.length !== uniqueIds.length) return DOCUMENT_NOT_FOUND;

        const usedPaths = new Set([MISSING_FILES_NAME.toLowerCase()]);
        const entries = [];
        const missing = [];

        // Mesma ordem sempre: fornecedor, solicitação, colaborador, tipo
        const ordered = [...documents].sort((a, b) =>
            `${zipFolder(a)}/${zipFileName(a)}`.localeCompare(`${zipFolder(b)}/${zipFileName(b)}`, 'pt-BR'));

        for (const document of ordered) {
            const name = uniquePath(`${zipFolder(document)}/${zipFileName(document)}`, usedPaths);
            const absolutePath = existingFilePath(document);
            if (absolutePath) entries.push({ absolutePath, name });
            else missing.push({ id: document.id, name });
        }

        if (entries.length === 0) {
            return { success: false, status: 404, message: 'Nenhum dos arquivos selecionados foi encontrado no servidor.' };
        }

        const missingText = missing.length > 0
            ? [
                'Estes documentos estão cadastrados, mas o arquivo não foi encontrado no servidor:',
                '',
                ...missing.map((item) => `- ${item.name} (documento #${item.id})`),
                '',
            ].join('\r\n')
            : null;

        const zipName = zipArchiveName();
        await auditDownload(context, AUDIT_ACTIONS.DOCUMENT_DOWNLOAD_ZIP, null, {
            document_ids: uniqueIds,
            ...(missing.length > 0 && { missing_document_ids: missing.map((item) => item.id).sort((a, b) => a - b) }),
            zip_name: zipName,
        });

        return { success: true, body: { zipName, entries, missingText, missingFileName: MISSING_FILES_NAME } };
    } catch (error) {
        console.error('Erro no prepareZipDownload service:', error);
        return { success: false, status: 500, message: 'Erro ao preparar o download dos documentos.' };
    }
}
