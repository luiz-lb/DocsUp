import * as supplierAuthService from '../services/supplierAuthService.js';

// Opções do cookie do JWT de fornecedor
const SUPPLIER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 horas
};

// ─────────────────────────────────────────────
// Validação de CNPJ (chamada pública durante o registro)
// POST /supplier/auth/validate-cnpj
// ─────────────────────────────────────────────
export async function validateCnpj(req, res) {
    try {
        const { cnpj } = req.body;

        if (!cnpj) {
            return res.status(400).json({ success: false, body: { message: 'CNPJ é obrigatório.' } });
        }

        const result = await supplierAuthService.validateCnpjPublicApi(cnpj);
        return res.status(200).json({ success: true, body: result });
    } catch (error) {
        console.error('validateCnpj controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Registro
// POST /supplier/auth/register
// ─────────────────────────────────────────────
export async function register(req, res) {
    try {
        const {
            cnpj, razaoSocial, nomeFantasia, password,
            employeeCount, city, state,
            contacts, categoryIds, regionIds,
        } = req.body;

        console.log("::::", req.body)

        if (!cnpj || !razaoSocial || !password) {
            return res.status(400).json({
                success: false,
                body: { message: 'cnpj, razaoSocial e password são obrigatórios.' },
            });
        }

        const result = await supplierAuthService.registerSupplier({
            cnpj, razaoSocial, nomeFantasia, password,
            employeeCount, city, state,
            contacts, categoryIds, regionIds,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({
            success: true,
            body: { message: 'Fornecedor cadastrado com sucesso.', supplierId: result.supplierId },
        });
    } catch (error) {
        console.error('register supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Login Fase 1: CNPJ + senha → envia OTP
// POST /supplier/auth/login
// ─────────────────────────────────────────────
export async function login(req, res) {
    try {
        const { cnpj, password } = req.body;

        if (!cnpj || !password) {
            return res.status(400).json({
                success: false,
                body: { message: 'CNPJ e senha são obrigatórios.' },
            });
        }

        const result = await supplierAuthService.loginPhase1(cnpj, password, req.session);

        if (!result.success) {
            return res.status(401).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({
            success: true,
            body: {
                message: 'Código enviado para os emails cadastrados.',
                requiresMfa: true,
                // Apenas em desenvolvimento para facilitar testes
                ...(result.devOtp && { devOtp: result.devOtp }),
            },
        });
    } catch (error) {
        console.error('login supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Login Fase 2: valida OTP e emite JWT
// POST /supplier/auth/verify-mfa
// ─────────────────────────────────────────────
export async function verifyMfa(req, res) {
    try {
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, body: { message: 'Código OTP é obrigatório.' } });
        }

        const result = await supplierAuthService.loginPhase2(otp, req.session);

        if (!result.success) {
            return res.status(401).json({ success: false, body: { message: result.message } });
        }

        // Seta o JWT em cookie HttpOnly separado do cookie de colaboradores
        res.cookie('supplier_token', result.token, SUPPLIER_COOKIE_OPTIONS);

        console.log(`Fornecedor ID ${result.supplier.id} autenticado com MFA.`);

        return res.status(200).json({
            success: true,
            body: {
                message: 'Autenticado com sucesso.',
                supplier: result.supplier,
            },
        });
    } catch (error) {
        console.error('verifyMfa controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Logout
// POST /supplier/auth/logout
// ─────────────────────────────────────────────
export async function logout(req, res) {
    res.clearCookie('supplier_token');
    if (req.session) {
        delete req.session.mfaPending;
    }
    return res.status(200).json({ success: true, body: { message: 'Logout realizado.' } });
}

// ─────────────────────────────────────────────
// Me — retorna dados do fornecedor autenticado
// GET /supplier/auth/me
// ─────────────────────────────────────────────
export async function getMe(req, res) {
    try {
        return res.status(200).json({
            success: true,
            body: {
                supplierId: req.fornecedor.supplierId,
                cnpj: req.fornecedor.cnpj,
                razaoSocial: req.fornecedor.razaoSocial,
            },
        });
    } catch (error) {
        console.error('getMe supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
