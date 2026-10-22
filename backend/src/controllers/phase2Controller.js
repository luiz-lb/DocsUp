import multer from 'multer';
import * as phase2Service from '../services/phase2Service.js';
import { sendPrivateFile } from '../utils/fileResponse.js';

// ── Configuração do multer (memória — salva em disco no service) ──────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por arquivo
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo não permitido. Use PDF, JPG ou PNG.'));
        }
    },
});

export const uploadMiddleware = upload.array('files', 20); // máximo 20 arquivos por chamada

/**
 * Campo de multipart com JSON (ex.: '[1,2]'). Vazio ou ausente = undefined. Se o campo
 * vier repetido, o multer já entrega um array. JSON inválido volta como texto e o
 * service recusa (não é array).
 */
function parseJsonField(value) {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

// ─────────────────────────────────────────────
// GET /phase2/:token  (requer JWT de fornecedor — só o fornecedor dono do link)
// ─────────────────────────────────────────────
export async function getPhase2(req, res) {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, body: { message: 'Token é obrigatório.' } });
        }

        const result = await phase2Service.getPhase2ByToken(token, req.fornecedor.supplierId);
        if (!result.success) {
            return res.status(result.status ?? 404).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getPhase2 controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// GET /phase2/supplier/requests  (requer JWT de fornecedor)
// Solicitações da Fase 2 do fornecedor logado (portal, menu "Documentos (Fase 2)")
// ─────────────────────────────────────────────
export async function listMyRequests(req, res) {
    try {
        const result = await phase2Service.listSupplierPhase2Requests(req.fornecedor.supplierId);
        if (!result.success) {
            return res.status(result.status ?? 500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('phase2 listMyRequests controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// GET /phase2/:token/documents/:documentId/download  (requer JWT de fornecedor)
// O fornecedor baixa um arquivo que ele enviou nesta solicitação (atual ou do histórico)
// ─────────────────────────────────────────────
export async function downloadDocument(req, res) {
    try {
        const documentId = Number(req.params.documentId);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'Documento inválido.' } });
        }

        const result = await phase2Service.prepareSupplierDownload(
            req.params.token,
            req.fornecedor.supplierId,
            documentId,
            {
                ipAddress: req.ip ? req.ip.replace(/^::ffff:/, '') : null,
                userAgent: req.headers['user-agent'] ?? null,
            },
        );
        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        return sendPrivateFile(res, result.body.absolutePath, result.body.fileName, 'phase2 downloadDocument');
    } catch (error) {
        console.error('phase2 downloadDocument controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// POST /phase2/:token/employee  (requer JWT de fornecedor)
// Body: multipart/form-data
//   fields: fullName, cpf, rg?, roleFunction?, documentTypeId, expiresAt? ('YYYY-MM-DD')
//   files:  files[] (exatamente 1)
// ─────────────────────────────────────────────
export async function addEmployee(req, res) {
    try {
        const { token } = req.params;
        const supplierId = req.fornecedor.supplierId;

        const { fullName, cpf, rg, roleFunction, documentTypeId, expiresAt } = req.body ?? {};

        const result = await phase2Service.addEmployee(
            token,
            supplierId,
            { fullName, cpf, rg, roleFunction, documentTypeId, expiresAt },
            req.files ?? [],
        );

        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: result.body });
    } catch (error) {
        console.error('addEmployee controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// POST /phase2/:token/company-documents  (requer JWT de fornecedor)
// Body: multipart/form-data
//   fields: documentTypeIds (JSON array, obrigatório, paralelo a files)
//           expiresAt       (JSON array de 'YYYY-MM-DD' ou null, opcional, paralelo a files)
//   files:  files[]
// ─────────────────────────────────────────────
export async function addCompanyDocuments(req, res) {
    try {
        const { token } = req.params;
        const supplierId = req.fornecedor.supplierId;

        const result = await phase2Service.addCompanyDocuments(
            token,
            supplierId,
            {
                documentTypeIds: parseJsonField(req.body?.documentTypeIds),
                expiresAt: parseJsonField(req.body?.expiresAt),
            },
            req.files ?? [],
        );

        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: result.body });
    } catch (error) {
        console.error('addCompanyDocuments controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// GET /phase2/employees  (painel interno)
// ─────────────────────────────────────────────
export async function listEmployees(req, res) {
    try {
        const result = await phase2Service.listAllEmployees();
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listEmployees controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
