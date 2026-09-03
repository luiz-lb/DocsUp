import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import * as supplierModel from '../models/supplierModel.js';
import * as trasaction from '../models/trasaction.js';

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Gera OTP numérico de 6 dígitos */
function generateOtp() {
    return String(Math.floor(100000 + crypto.randomInt(900000)));
}

/** Retorna o transporte de email configurado pelas env vars */
function createMailTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/** Emite um JWT de fornecedor (tipo separado do JWT de colaborador) */
function signSupplierToken(supplier) {
    return jwt.sign(
        {
            type: 'supplier',
            supplierId: supplier.id,
            cnpj: supplier.cnpj,
            razaoSocial: supplier.razao_social,
        },
        process.env.JWT_SECRET,
        { expiresIn: '4h' }
    );
}

// ─────────────────────────────────────────────
// Validação de CNPJ via API pública (ReceitaWS)
// ─────────────────────────────────────────────

/**
 * Consulta o CNPJ na API da ReceitaWS.
 * Retorna { valid, razaoSocial, situacao } ou { valid: false } em caso de erro.
 */
export async function validateCnpjPublicApi(cnpj) {
    try {
        const digits = cnpj.replace(/\D/g, '');
        const { data } = await axios.get(`https://receitaws.com.br/v1/cnpj/${digits}`, {
            timeout: 8000,
        });

        if (data.status === 'ERROR') {
            return { valid: false, razaoSocial: null, situacao: null };
        }

        return {
            valid: true,
            razaoSocial: data.nome ?? null,
            nomeFantasia: data.fantasia ?? null,
            situacao: data.situacao ?? null,
            municipio: data.municipio ?? null,
            uf: data.uf ?? null,
        };
    } catch (error) {
        console.error('validateCnpjPublicApi error:', error.message);
        // Falha na API externa não deve bloquear o cadastro; retornamos válido sem dados
        return { valid: true, razaoSocial: null, nomeFantasia: null, situacao: 'DESCONHECIDO' };
    }
}

// ─────────────────────────────────────────────
// Registro de fornecedor
// ─────────────────────────────────────────────

/**
 * Registra um novo fornecedor no sistema.
 *
 * Payload esperado:
 *  cnpj, razaoSocial, nomeFantasia?, password,
 *  employeeCount?, city?, state?,
 *  contacts: [{ name, email, phone?, contactType, isPrimary }],
 *  categoryIds?: number[],
 *  regionIds?:   number[]
 */
export async function registerSupplier(payload) {
    const {
        cnpj, razaoSocial, nomeFantasia, password,
        employeeCount, city, state,
        contacts = [],
        categoryIds = [],
        regionIds = [],
    } = payload;

    console.log("::::", payload)

    // Validações básicas
    if (!cnpj || !razaoSocial || !password) {
        return { success: false, message: 'cnpj, razaoSocial e password são obrigatórios.' };
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const formattedCnpj = cleanCnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
    );

    // Verifica duplicidade
    const exists = await supplierModel.supplierExistsByCnpj(formattedCnpj);
    if (exists) {
        return { success: false, message: 'CNPJ já cadastrado. Acesse com seu login.' };
    }

    // Contatos obrigatórios: legal (0) e operacional (1)
    const legalContact    = contacts.find((c) => c.contactType === 0);
    const opContact       = contacts.find((c) => c.contactType === 1);
    if (!legalContact?.email || !opContact?.email) {
        return { success: false, message: 'Emails do responsável legal e operacional são obrigatórios.' };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        const supplierId = await supplierModel.insertSupplier(transaction, {
            cnpj: formattedCnpj,
            razaoSocial,
            nomeFantasia,
            employeeCount,
            city,
            state,
            passwordHash,
        });

        if (!supplierId) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return { success: false, message: 'Erro ao criar fornecedor no banco de dados.' };
        }

        // Insere contatos
        for (const contact of contacts) {
            await supplierModel.insertSupplierContact(transaction, {
                supplierId,
                name: contact.name ?? '',
                email: contact.email,
                phone: contact.phone ?? null,
                contactType: contact.contactType,
                isPrimary: contact.isPrimary ?? false,
            });
        }

        // Insere categorias
        for (const catId of categoryIds) {
            await supplierModel.insertSupplierCategory(transaction, supplierId, catId);
        }

        // Insere regiões
        for (const regId of regionIds) {
            await supplierModel.insertSupplierRegion(transaction, supplierId, regId);
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        console.log(`Fornecedor registrado com sucesso: CNPJ ${formattedCnpj}, ID ${supplierId}`);
        return { success: true, supplierId };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('registerSupplier error:', error);
        return { success: false, message: 'Erro interno ao registrar fornecedor.' };
    }
}

// ─────────────────────────────────────────────
// Login — Fase 1: valida credenciais e envia OTP
// ─────────────────────────────────────────────

/**
 * Fase 1 do login: verifica CNPJ + senha e envia OTP por email.
 * O OTP é armazenado (hash + expiração) na sessão do servidor.
 *
 * @param {string} cnpj
 * @param {string} password
 * @param {object} session  — req.session do Express
 */
export async function loginPhase1(cnpj, password, session) {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const formattedCnpj = cleanCnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
    );

    const supplier = await supplierModel.getSupplierByCnpj(formattedCnpj);

    if (!supplier) {
        return { success: false, message: 'CNPJ não cadastrado.' };
    }

    if (supplier.status === 3) {
        return { success: false, message: 'Fornecedor bloqueado. Entre em contato com Suprimentos.' };
    }

    const passwordMatch = await bcrypt.compare(password, supplier.password_hash);
    if (!passwordMatch) {
        return { success: false, message: 'Senha incorreta.' };
    }

    // Gera OTP e salva o hash na sessão (nunca o OTP em texto puro)
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 8);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos

    session.mfaPending = {
        supplierId: supplier.id,
        otpHash,
        expiresAt,
    };

    // Busca emails dos contatos para enviar o código
    const contacts = await supplierModel.getSupplierContactEmails(supplier.id);
    const emailsToNotify = contacts.map((c) => c.email).filter(Boolean);

    if (emailsToNotify.length === 0) {
        console.warn(`Fornecedor ID ${supplier.id} não tem emails de contato cadastrados.`);
        // Em ambiente de desenvolvimento, logamos o OTP para não travar o fluxo
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] OTP para CNPJ ${formattedCnpj}: ${otp}`);
        }
    } else {
        try {
            const transporter = createMailTransport();
            await transporter.sendMail({
                from: `"DocsUp" <${process.env.SMTP_USER}>`,
                to: emailsToNotify.join(', '),
                subject: 'Seu código de acesso ao Portal do Fornecedor',
                html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
                        <h2 style="color: #004643;">Portal do Fornecedor</h2>
                        <p>Um novo acesso foi solicitado para o CNPJ <strong>${formattedCnpj}</strong>.</p>
                        <p>Seu código de verificação é:</p>
                        <div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.3em;
                                    background: #f3f4f6; padding: 1rem 2rem;
                                    border-radius: 8px; text-align: center; margin: 1rem 0;">
                            ${otp}
                        </div>
                        <p style="color: #6b7280; font-size: 0.875rem;">
                            Este código expira em 10 minutos. Se não foi você, ignore este email.
                        </p>
                    </div>
                `,
            });
        } catch (emailError) {
            console.error('Erro ao enviar email MFA:', emailError.message);
            // Não bloqueia o fluxo — em desenvolvimento o OTP fica no log
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[DEV] OTP para CNPJ ${formattedCnpj}: ${otp}`);
            }
        }
    }

    return {
        success: true,
        requiresMfa: true,
        // Em DEV enviamos o OTP na resposta para facilitar testes sem SMTP configurado
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    };
}

// ─────────────────────────────────────────────
// Login — Fase 2: valida OTP e emite JWT
// ─────────────────────────────────────────────

/**
 * Fase 2 do login: valida o OTP e emite o JWT de fornecedor.
 *
 * @param {string} otp
 * @param {object} session — req.session do Express
 */
export async function loginPhase2(otp, session) {
    const pending = session.mfaPending;

    if (!pending) {
        return { success: false, message: 'Sessão de MFA não iniciada. Faça login novamente.' };
    }

    if (Date.now() > pending.expiresAt) {
        delete session.mfaPending;
        return { success: false, message: 'Código expirado. Faça login novamente.' };
    }

    const otpMatch = await bcrypt.compare(otp, pending.otpHash);
    if (!otpMatch) {
        return { success: false, message: 'Código inválido.' };
    }

    // OTP válido — limpa a sessão de MFA
    const supplierId = pending.supplierId;
    delete session.mfaPending;

    // Busca dados completos para o payload do token
    const supplier = await supplierModel.getSupplierById(supplierId);
    if (!supplier) {
        return { success: false, message: 'Fornecedor não encontrado.' };
    }

    const token = signSupplierToken(supplier);

    return {
        success: true,
        token,
        supplier: {
            id: supplier.id,
            cnpj: supplier.cnpj,
            razaoSocial: supplier.razao_social,
            nomeFantasia: supplier.nome_fantasia,
            registrationComplete: supplier.registration_complete,
        },
    };
}
