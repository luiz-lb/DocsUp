import * as supplierAuthService from '../services/supplierAuthService.js';
import { SUPPLIER_COOKIE_OPTIONS } from '../config/authCookies.js';

/** IP e navegador de quem fez a ação (auditoria). Atrás de proxy, depende do TRUST_PROXY. */
function supplierContext(req) {
    return {
        ipAddress: req.ip ? req.ip.replace(/^::ffff:/, '') : null,
        userAgent: req.headers['user-agent'] ?? null,
    };
}

function fail(res, result, fallbackStatus = 400) {
    return res.status(result.status ?? fallbackStatus).json({ success: false, body: { message: result.message } });
}

// ─────────────────────────────────────────────
// Validação de CNPJ (pública, durante o cadastro)
// POST /supplier/auth/validate-cnpj
// ─────────────────────────────────────────────
export async function validateCnpj(req, res) {
    try {
        const { cnpj } = req.body ?? {};
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
// Cadastro
// POST /supplier/auth/register
// Body: { cnpj, razaoSocial, nomeFantasia?, owner: { name, email }, operator: { name, email }, password }
// ─────────────────────────────────────────────
export async function register(req, res) {
    try {
        const result = await supplierAuthService.registerSupplier(req.body ?? {});
        if (!result.success) return fail(res, result);

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
// Login Fase 1: e-mail + senha → envia o código
// POST /supplier/auth/login
// ─────────────────────────────────────────────
export async function login(req, res) {
    try {
        const { email, password } = req.body ?? {};
        const result = await supplierAuthService.loginPhase1(email, password, req.session);
        if (!result.success) return fail(res, result, 401);

        return res.status(200).json({
            success: true,
            body: {
                message: 'Código enviado para o seu e-mail.',
                requiresMfa: true,
                // Apenas fora de produção, para testar sem SMTP
                ...(result.devOtp && { devOtp: result.devOtp }),
            },
        });
    } catch (error) {
        console.error('login supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Login Fase 2: confere o código e emite o JWT
// POST /supplier/auth/verify-mfa
// ─────────────────────────────────────────────
export async function verifyMfa(req, res) {
    try {
        const { otp } = req.body ?? {};
        if (!otp) {
            return res.status(400).json({ success: false, body: { message: 'Informe o código de verificação.' } });
        }

        const result = await supplierAuthService.loginPhase2(String(otp), req.session);
        if (!result.success) {
            return res.status(401).json({ success: false, body: { message: result.message } });
        }

        // JWT em cookie HttpOnly separado do cookie de colaboradores
        res.cookie('supplier_token', result.token, SUPPLIER_COOKIE_OPTIONS);

        return res.status(200).json({
            success: true,
            body: { message: 'Autenticado com sucesso.', supplier: result.supplier },
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
    res.clearCookie('supplier_token', SUPPLIER_COOKIE_OPTIONS);
    if (req.session) {
        delete req.session.mfaPending;
    }
    return res.status(200).json({ success: true, body: { message: 'Logout realizado.' } });
}

// ─────────────────────────────────────────────
// Me — dados da sessão do fornecedor
// GET /supplier/auth/me
// ─────────────────────────────────────────────
export async function getMe(req, res) {
    const f = req.fornecedor;
    return res.status(200).json({
        success: true,
        body: {
            supplierId: f.supplierId,
            cnpj: f.cnpj,
            razaoSocial: f.razaoSocial,
            nomeFantasia: f.nomeFantasia,
            user: { id: f.supplierUserId, role: f.role, name: f.name, email: f.email },
        },
    });
}

// ─────────────────────────────────────────────
// Perfil — GET /supplier/auth/profile
// ─────────────────────────────────────────────
export async function getProfile(req, res) {
    try {
        const result = await supplierAuthService.getSupplierProfile(req.fornecedor.supplierId, req.fornecedor.supplierUserId);
        if (!result.success) return fail(res, result, 404);
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getProfile controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Dados da empresa — PUT /supplier/auth/profile  Body: { nomeFantasia }
// ─────────────────────────────────────────────
export async function updateProfile(req, res) {
    try {
        const result = await supplierAuthService.updateCompany(req.fornecedor, req.body ?? {});
        if (!result.success) return fail(res, result);
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('updateProfile controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Usuário — PUT /supplier/auth/users/:id  Body: { name, email, password? }
// ─────────────────────────────────────────────
export async function updateUser(req, res) {
    try {
        const targetUserId = Number(req.params.id);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'Usuário inválido.' } });
        }
        const result = await supplierAuthService.updateSupplierUser(
            req.fornecedor, targetUserId, req.body ?? {}, supplierContext(req),
        );
        if (!result.success) return fail(res, result);
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('updateUser supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Usuário que falta — POST /supplier/auth/users  Body: { role, name, email, password }
// ─────────────────────────────────────────────
export async function createUser(req, res) {
    try {
        const result = await supplierAuthService.createMissingUser(req.fornecedor, req.body ?? {}, supplierContext(req));
        if (!result.success) return fail(res, result);
        return res.status(201).json({ success: true, body: result.body });
    } catch (error) {
        console.error('createUser supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

// ─────────────────────────────────────────────
// Própria senha — PUT /supplier/auth/password  Body: { currentPassword, newPassword }
// ─────────────────────────────────────────────
export async function changePassword(req, res) {
    try {
        const result = await supplierAuthService.changeOwnPassword(req.fornecedor, req.body ?? {}, supplierContext(req));
        if (!result.success) return fail(res, result);

        // As sessões anteriores caem: esta continua com um token novo
        res.cookie('supplier_token', result.token, SUPPLIER_COOKIE_OPTIONS);
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('changePassword supplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
