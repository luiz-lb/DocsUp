import multer from 'multer';
import * as phase2Service from '../services/phase2Service.js';

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

// ─────────────────────────────────────────────
// GET /phase2/:token  (público — fornecedor acessa pelo link)
// ─────────────────────────────────────────────
export async function getPhase2(req, res) {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, body: { message: 'Token é obrigatório.' } });
        }

        const result = await phase2Service.getPhase2ByToken(token);
        if (!result.success) {
            return res.status(404).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getPhase2 controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// POST /phase2/:token/employee  (requer JWT de fornecedor)
// Body: multipart/form-data
//   fields: fullName, cpf, rg?, roleFunction, nrTypeIds (JSON array string)
//   files:  files[]
// ─────────────────────────────────────────────
export async function addEmployee(req, res) {
    try {
        const { token } = req.params;
        const supplierId = req.fornecedor.supplierId;

        const { fullName, cpf, rg, roleFunction, nrTypeId } = req.body;

        const result = await phase2Service.addEmployee(
            token,
            supplierId,
            { fullName, cpf, rg, roleFunction, nrTypeId: nrTypeId ? Number(nrTypeId) : null },
            req.files ?? [],
        );

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
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
//   fields: documentTypeIds (JSON array string, paralelo a files — opcional)
//   files:  files[]
// ─────────────────────────────────────────────
export async function addCompanyDocuments(req, res) {
    try {
        const { token } = req.params;
        const supplierId = req.fornecedor.supplierId;

        // documentTypeIds pode vir como string JSON ou array (1:1 com os arquivos)
        let documentTypeIds = [];
        try {
            documentTypeIds = JSON.parse(req.body.documentTypeIds ?? '[]');
        } catch {
            documentTypeIds = [];
        }

        const result = await phase2Service.addCompanyDocuments(
            token,
            supplierId,
            { documentTypeIds },
            req.files ?? [],
        );

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
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
