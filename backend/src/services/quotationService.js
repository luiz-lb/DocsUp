import crypto from 'crypto';
import nodemailer from 'nodemailer';
import * as quotationModel from '../models/quotationModel.js';
import * as supplierModel from '../models/supplierModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as trasaction from '../models/trasaction.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createMailTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
}

// ─────────────────────────────────────────────
// Criar rodada de cotação + convidar fornecedores
// ─────────────────────────────────────────────

/**
 * Cria uma rodada de cotação e envia convites por email.
 *
 * @param {{ laborRequestId, deadline, deadlineHoursPhase2?, createdBy, invitees }} payload
 *   invitees: Array de { supplierId?, email }
 */
export async function createRound(payload) {
    const { laborRequestId, deadline, createdBy, invitees = [] } = payload;

    if (!laborRequestId || !deadline || !createdBy) {
        return { success: false, message: 'laborRequestId, deadline e createdBy são obrigatórios.' };
    }

    if (invitees.length === 0) {
        return { success: false, message: 'Informe ao menos um fornecedor para convidar.' };
    }

    // Confirma que a solicitação está em status 3 (Em Cotação)
    const laborRequest = await laborRequestModel.getLaborRequestById(laborRequestId);
    if (!laborRequest) {
        return { success: false, message: 'Solicitação não encontrada.' };
    }
    if (laborRequest.status !== 3) {
        return { success: false, message: 'A solicitação precisa estar com status "Em Cotação" para criar uma rodada.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        // Cria a rodada
        const roundId = await quotationModel.insertQuotationRound(transaction, {
            laborRequestId,
            deadline: new Date(deadline),
            createdBy,
        });

        if (!roundId) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return { success: false, message: 'Erro ao criar rodada.' };
        }

        // Gera tokens e cria convites
        const inviteTokens = [];
        for (const invitee of invitees) {
            const token = generateToken();
            await quotationModel.insertQuotationInvite(transaction, {
                roundId,
                supplierId: invitee.supplierId ?? null,
                inviteEmail: invitee.email ?? null,
                inviteToken: token,
            });
            inviteTokens.push({ email: invitee.email, token });
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Envia emails de convite (fora da transação — falha de email não reverte o round)
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        try {
            const transporter = createMailTransport();
            for (const { email, token } of inviteTokens) {
                if (!email) continue;
                const link = `${frontendUrl}/cotacoes/responder/${token}`;
                await transporter.sendMail({
                    from: `"DocsUp Suprimentos" <${process.env.SMTP_USER}>`,
                    to: email,
                    subject: `Convite para cotação: ${laborRequest.title}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
                            <h2 style="color: #004643;">Convite para cotação</h2>
                            <p>Você foi convidado para apresentar uma proposta para o serviço:</p>
                            <p style="font-size: 1.1rem; font-weight: bold;">${laborRequest.title}</p>
                            <p><strong>Local:</strong> ${laborRequest.location ?? '—'}</p>
                            <p><strong>Prazo para resposta:</strong> ${new Date(deadline).toLocaleString('pt-BR')}</p>
                            <p style="margin-top: 1.5rem;">
                                <a href="${link}"
                                   style="background:#004643; color:#fff; padding:12px 24px;
                                          border-radius:6px; text-decoration:none; font-weight:bold;">
                                    Responder cotação
                                </a>
                            </p>
                            <p style="color:#6b7280; font-size:0.8rem; margin-top:1rem;">
                                Este link é único e intransferível. Prazo: ${new Date(deadline).toLocaleString('pt-BR')}.
                            </p>
                        </div>
                    `,
                });
            }
        } catch (emailError) {
            console.error('Erro ao enviar emails de convite:', emailError.message);
            // Não reverte — tokens já estão no banco
        }

        console.log(`Rodada ${roundId} criada para solicitação ${laborRequestId} com ${invitees.length} convites.`);
        return { success: true, roundId, inviteCount: invitees.length };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('createRound error:', error);
        return { success: false, message: 'Erro interno ao criar rodada.' };
    }
}

// ─────────────────────────────────────────────
// Buscar dados da rodada (painel interno)
// ─────────────────────────────────────────────

export async function getRound(roundId) {
    try {
        const round = await quotationModel.getQuotationRoundById(roundId);
        if (!round) {
            return { success: false, message: 'Rodada não encontrada.' };
        }
        // Retorna convites + cotação (quando existir) via JOIN
        const invites = await quotationModel.getInvitesWithQuotationsByRoundId(roundId);
        return { success: true, body: { round: { ...round, invites } } };
    } catch (error) {
        console.error('getRound error:', error);
        return { success: false, message: 'Erro ao buscar rodada.' };
    }
}

// ─────────────────────────────────────────────
// Buscar convite pelo token (portal do fornecedor)
// ─────────────────────────────────────────────

/**
 * Retorna os dados necessários para o fornecedor preencher a cotação:
 * convite, rodada, labor_request, documentos obrigatórios, NR types, cotação já existente.
 */
export async function getInviteByToken(token) {
    try {
        const invite = await quotationModel.getInviteByToken(token);
        if (!invite) {
            return { success: false, message: 'Link de cotação inválido ou expirado.' };
        }

        // Marca como visualizado (idempotente)
        await quotationModel.markInviteViewed(invite.id);

        const round = await quotationModel.getQuotationRoundById(invite.round_id);
        if (!round) {
            return { success: false, message: 'Rodada de cotação não encontrada.' };
        }

        // Verifica prazo
        const now = new Date();
        const deadline = new Date(round.deadline);
        if (now > deadline) {
            return { success: false, message: 'O prazo para esta cotação já encerrou.' };
        }

        // Busca dados da solicitação e documentos obrigatórios
        const laborRequest = await laborRequestModel.getLaborRequestById(round.labor_request_id);
        const requiredDocs = await laborRequestModel.getLaborRequestDocuments(round.labor_request_id);

        // Verifica se já existe cotação submetida para esse convite
        let existingQuotation = null;
        if (invite.supplier_id) {
            const allQuots = await quotationModel.getQuotationsByRoundId(round.id);
            existingQuotation = allQuots.find(
                (q) => q.supplier_id === invite.supplier_id && q.status >= 1
            ) ?? null;
        }

        return {
            success: true,
            body: {
                invite,
                round,
                laborRequest: { ...laborRequest, requiredDocuments: requiredDocs },
                existingQuotation,
            },
        };
    } catch (error) {
        console.error('getInviteByToken error:', error);
        return { success: false, message: 'Erro ao buscar convite.' };
    }
}

// ─────────────────────────────────────────────
// Submeter cotação
// ─────────────────────────────────────────────

/**
 * Submete a cotação do fornecedor.
 *
 * @param {string} token  — token do convite
 * @param {object} payload — { totalValue, notes?, nrDeclarations[], checklist[], checklistAccepted, omissionWarningAccepted }
 * @param {number} supplierId — extraído do JWT do fornecedor
 * @param {string} clientIp
 * @param {string} userAgent
 */
export async function submitQuotation(token, payload, supplierId, clientIp, userAgent) {
    const {
        totalValue, notes,
        nrDeclarations = [],
        checklist = [],
        checklistAccepted,
        omissionWarningAccepted,
    } = payload;

    if (!totalValue || totalValue <= 0) {
        return { success: false, message: 'Valor total inválido.' };
    }
    if (!checklistAccepted || !omissionWarningAccepted) {
        return { success: false, message: 'É necessário aceitar os termos do checklist e da advertência de omissão.' };
    }

    const invite = await quotationModel.getInviteByToken(token);
    if (!invite) {
        return { success: false, message: 'Token de convite inválido.' };
    }

    // Vincula o fornecedor ao convite se ainda não estiver vinculado
    const effectiveSupplierId = invite.supplier_id ?? supplierId;
    if (!effectiveSupplierId) {
        return { success: false, message: 'Fornecedor não identificado.' };
    }

    // Confere se já submeteu
    if (invite.status >= 2) {
        return { success: false, message: 'Você já enviou uma cotação para este convite.' };
    }

    const round = await quotationModel.getQuotationRoundById(invite.round_id);
    if (!round || round.status !== 0) {
        return { success: false, message: 'Esta rodada de cotação não está mais aberta.' };
    }

    // Verifica prazo
    if (new Date() > new Date(round.deadline)) {
        return { success: false, message: 'O prazo para envio de cotações encerrou.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        // Insere cotação principal
        const quotationId = await quotationModel.insertQuotation(transaction, {
            roundId: round.id,
            supplierId: effectiveSupplierId,
            inviteId: invite.id,
            totalValue,
            currency: 'BRL',
            notes,
            checklistAccepted: Boolean(checklistAccepted),
            omissionWarningAccepted: Boolean(omissionWarningAccepted),
            acceptanceIp: clientIp,
            acceptanceUserAgent: userAgent,
        });

        if (!quotationId) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return { success: false, message: 'Erro ao registrar cotação.' };
        }

        // Insere declarações de NR
        for (const decl of nrDeclarations) {
            await quotationModel.insertNrDeclaration(transaction, quotationId, decl.nrTypeId, decl.employeeCount);
        }

        // Insere checklist da empresa
        for (const item of checklist) {
            await quotationModel.insertCompanyChecklist(transaction, quotationId, item.documentTypeId, item.hasDocument);
        }

        // Marca o convite como respondido e vincula o fornecedor (caso convite por email)
        await quotationModel.markInviteResponded(transaction, invite.id, effectiveSupplierId);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Busca cotação completa para retornar (com acceptance_at e ip)
        const saved = await quotationModel.getQuotationById(quotationId);

        console.log(`Cotação ${quotationId} submetida pelo fornecedor ${effectiveSupplierId}.`);
        return { success: true, body: { quotation: saved } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('submitQuotation error:', error);
        return { success: false, message: 'Erro interno ao submeter cotação.' };
    }
}

// ─────────────────────────────────────────────
// Declarar vencedor e iniciar Phase 2
// ─────────────────────────────────────────────

/**
 * Suprimentos declara o vencedor de uma rodada.
 * 1. Atualiza status das cotações (vencedora=2, perdedoras=3).
 * 2. Encerra a rodada (status=1).
 * 3. Cria phase2_deadline para o vencedor.
 * 4. Envia email ao fornecedor vencedor com link da Fase 2.
 *
 * @param {{ roundId, winnerQuotationId, deadlineHours?, userId }} payload
 */
export async function declareWinner(payload) {
    const { roundId, winnerQuotationId, deadlineHours = 72, userId } = payload;

    // Carrega dados do round e da cotação vencedora
    const round = await quotationModel.getQuotationRoundById(roundId);
    if (!round) {
        return { success: false, message: 'Rodada não encontrada.' };
    }
    if (round.status !== 0) {
        return { success: false, message: 'Esta rodada já foi encerrada.' };
    }

    const allQuotations = await quotationModel.getQuotationsByRoundId(roundId);
    const winner = allQuotations.find((q) => q.id === winnerQuotationId);
    if (!winner) {
        return { success: false, message: 'Cotação vencedora não encontrada nesta rodada.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        // Atualiza status de todas as cotações e seus rankings
        for (let i = 0; i < allQuotations.length; i++) {
            const q = allQuotations[i];
            const newStatus = q.id === winnerQuotationId ? 2 : 3; // 2=Vencedora, 3=Perdedora
            await quotationModel.updateQuotationStatus(transaction, q.id, newStatus);
            await quotationModel.updateQuotationRanking(transaction, q.id, i + 1);
        }

        // Encerra a rodada
        await quotationModel.updateRoundStatus(transaction, roundId, 1);

        // Cria o deadline de Fase 2 para o vencedor
        const linkToken = generateToken();
        const phase2Record = await quotationModel.insertPhase2Deadline(transaction, {
            quotationId: winnerQuotationId,
            supplierId: winner.supplier_id,
            laborRequestId: round.labor_request_id,
            linkToken,
            deadlineHours,
        });

        // Atualiza status da labor_request para "Em Contratação" (5)
        await laborRequestModel.updateLaborRequestStatus(transaction, round.labor_request_id, 5, userId);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Envia email ao fornecedor vencedor com link da Fase 2
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        const phase2Link = `${frontendUrl}/fase2/${linkToken}`;

        try {
            const contacts = await supplierModel.getSupplierContactEmails(winner.supplier_id);
            const emails = contacts.map((c) => c.email).filter(Boolean);

            if (emails.length > 0) {
                const transporter = createMailTransport();
                await transporter.sendMail({
                    from: `"DocsUp Suprimentos" <${process.env.SMTP_USER}>`,
                    to: emails.join(', '),
                    subject: 'Parabéns! Você ganhou a cotação — Envie os documentos dos colaboradores',
                    html: `
                        <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
                            <h2 style="color: #004643;">🏆 Proposta aceita!</h2>
                            <p>Parabéns! Sua empresa foi selecionada para o serviço:</p>
                            <p style="font-size: 1.1rem; font-weight: bold;">${round.labor_request_title}</p>
                            <p>
                                Agora você tem <strong>${deadlineHours} horas</strong> para enviar
                                a documentação dos colaboradores que trabalharão neste serviço.
                            </p>
                            <p><strong>Prazo expira em:</strong>
                                ${new Date(phase2Record.expires_at).toLocaleString('pt-BR')}
                            </p>
                            <p style="margin-top: 1.5rem;">
                                <a href="${phase2Link}"
                                   style="background:#004643; color:#fff; padding:12px 24px;
                                          border-radius:6px; text-decoration:none; font-weight:bold;">
                                    Enviar documentos dos colaboradores
                                </a>
                            </p>
                            <p style="color:#dc2626; font-weight:bold; margin-top:1rem;">
                                ⚠️ Não enviar no prazo pode resultar em desclassificação e penalidade no seu score.
                            </p>
                        </div>
                    `,
                });
            }
        } catch (emailError) {
            console.error('Erro ao enviar email Fase 2:', emailError.message);
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[DEV] Link Fase 2: ${phase2Link}`);
            }
        }

        console.log(`Vencedor declarado: cotação ${winnerQuotationId}, round ${roundId}. Fase 2 link: ${linkToken}`);
        return {
            success: true,
            body: {
                phase2DeadlineHours: deadlineHours,
                phase2Token: linkToken,
                expiresAt: phase2Record.expires_at,
                ...(process.env.NODE_ENV !== 'production' && { devPhase2Link: phase2Link }),
            },
        };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('declareWinner error:', error);
        return { success: false, message: 'Erro interno ao declarar vencedor.' };
    }
}

/**
 * Lista as cotações do fornecedor autenticado (portal do fornecedor).
 * Retorna cada convite com status e, quando enviada, os dados da cotação.
 */
export async function getQuotationsBySupplier(supplierId) {
    try {
        const rows = await quotationModel.getQuotationsBySupplierId(supplierId);
        return { success: true, body: { quotations: rows } };
    } catch (error) {
        console.error('getQuotationsBySupplier error:', error);
        return { success: false, message: 'Erro ao buscar cotações do fornecedor.' };
    }
}

/**
 * Compara várias cotações de uma mesma rodada.
 *
 * Retorna, para cada cotação: valor total, colaboradores declarados por NR e
 * o checklist de documentos da empresa (o que o fornecedor declarou ter).
 * Também retorna os "eixos" agregados (todas as NRs e todos os documentos
 * presentes no conjunto) para o front montar os gráficos comparativos.
 *
 * @param {number}   roundId
 * @param {number[]} quotationIds
 */
export async function compareQuotations(roundId, quotationIds) {
    try {
        if (!Array.isArray(quotationIds) || quotationIds.length < 2) {
            return { success: false, message: 'Selecione ao menos duas cotações para comparar.' };
        }

        const round = await quotationModel.getQuotationRoundById(roundId);
        if (!round) {
            return { success: false, message: 'Rodada não encontrada.' };
        }

        // Carrega cada cotação com detalhes (NR declarations + checklist)
        const details = [];
        for (const qid of quotationIds) {
            const q = await quotationModel.getQuotationById(Number(qid));
            // Garante que a cotação pertence à rodada informada
            if (q && q.round_id === round.id) {
                details.push(q);
            }
        }

        if (details.length < 2) {
            return { success: false, message: 'Cotações inválidas para esta rodada.' };
        }

        // Eixos agregados: NR types e document types presentes no conjunto
        const nrTypeIds = [...new Set(details.flatMap((q) => (q.nrDeclarations ?? []).map((n) => n.nr_type_id)))];
        const docTypeIds = [...new Set(details.flatMap((q) => (q.checklist ?? []).map((c) => c.document_type_id)))];

        const nrTypes = await quotationModel.getNrTypesByIds(nrTypeIds);
        const docTypes = await quotationModel.getDocumentTypesByIds(docTypeIds);

        // Monta a resposta normalizada por cotação
        const quotations = details.map((q) => {
            const nrMap = new Map((q.nrDeclarations ?? []).map((n) => [n.nr_type_id, n.employee_count]));
            const docSet = new Set(
                (q.checklist ?? []).filter((c) => c.has_document).map((c) => c.document_type_id),
            );

            const totalEmployees = (q.nrDeclarations ?? []).reduce(
                (sum, n) => sum + (n.employee_count ?? 0), 0,
            );

            return {
                id: q.id,
                supplierId: q.supplier_id,
                supplierName: q.supplier_name,
                totalValue: q.total_value,
                currency: q.currency,
                status: q.status,
                ranking: q.ranking,
                submittedAt: q.submitted_at,
                totalDeclaredEmployees: totalEmployees,
                declaredDocumentsCount: docSet.size,
                // vetores alinhados aos eixos para facilitar os gráficos
                employeesByNr: nrTypeIds.map((id) => nrMap.get(id) ?? 0),
                documentsPresence: docTypeIds.map((id) => (docSet.has(id) ? 1 : 0)),
            };
        });

        return {
            success: true,
            body: {
                round: {
                    id: round.id,
                    round_number: round.round_number,
                    labor_request_title: round.labor_request_title,
                },
                axes: {
                    nrTypes: nrTypeIds.map((id) => {
                        const nr = nrTypes.find((t) => t.id === id);
                        return { id, code: nr?.code ?? `NR#${id}`, name: nr?.name ?? '' };
                    }),
                    documentTypes: docTypeIds.map((id) => {
                        const dt = docTypes.find((t) => t.id === id);
                        return { id, name: dt?.name ?? `Doc#${id}` };
                    }),
                },
                quotations,
            },
        };
    } catch (error) {
        console.error('compareQuotations error:', error);
        return { success: false, message: 'Erro ao comparar cotações.' };
    }
}

/**
 * Lista os rounds de uma solicitação (painel interno).
 */
export async function listRoundsByLaborRequest(laborRequestId) {
    try {
        const rounds = await quotationModel.getRoundsByLaborRequestId(laborRequestId);
        return { success: true, body: { rounds } };
    } catch (error) {
        console.error('listRoundsByLaborRequest error:', error);
        return { success: false, message: 'Erro ao listar rodadas.' };
    }
}

/**
 * Adiciona um novo convite a uma rodada já existente.
 * O prazo (deadline) é herdado do round — não é possível alterar.
 * Envia o email de convite ao fornecedor com o mesmo link de cotação.
 *
 * @param {{ roundId, inviteeEmail, createdBy }} payload
 */
export async function addInviteToRound(payload) {
    const { roundId, inviteeEmail, createdBy } = payload;

    if (!roundId || !inviteeEmail) {
        return { success: false, message: 'roundId e email do fornecedor são obrigatórios.' };
    }

    // Carrega o round para herdar o deadline e validar o status
    const round = await quotationModel.getQuotationRoundById(roundId);
    if (!round) {
        return { success: false, message: 'Rodada não encontrada.' };
    }
    if (round.status !== 0) {
        return { success: false, message: 'Não é possível convidar para uma rodada encerrada.' };
    }

    // Verifica se o prazo já expirou
    if (new Date() > new Date(round.deadline)) {
        return { success: false, message: 'O prazo desta rodada já expirou. Não é possível adicionar novos convites.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        const token = generateToken();
        const inviteId = await quotationModel.insertQuotationInvite(transaction, {
            roundId,
            supplierId: null,
            inviteEmail: inviteeEmail,
            inviteToken: token,
        });

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Envia email com o mesmo prazo do round
        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
        const link = `${frontendUrl}/cotacoes/responder/${token}`;

        try {
            const transporter = createMailTransport();
            await transporter.sendMail({
                from: `"DocsUp Suprimentos" <${process.env.SMTP_USER}>`,
                to: inviteeEmail,
                subject: `Convite para cotação: ${round.labor_request_title}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 560px; margin: auto;">
                        <h2 style="color: #004643;">Convite para cotação</h2>
                        <p>Você foi convidado para apresentar uma proposta para o serviço:</p>
                        <p style="font-size: 1.1rem; font-weight: bold;">${round.labor_request_title}</p>
                        <p><strong>Prazo para resposta:</strong> ${new Date(round.deadline).toLocaleString('pt-BR')}</p>
                        <p style="margin-top: 1.5rem;">
                            <a href="${link}"
                               style="background:#004643; color:#fff; padding:12px 24px;
                                      border-radius:6px; text-decoration:none; font-weight:bold;">
                                Responder cotação
                            </a>
                        </p>
                        <p style="color:#6b7280; font-size:0.8rem; margin-top:1rem;">
                            Este link é único e intransferível.
                        </p>
                    </div>
                `,
            });
        } catch (emailError) {
            console.error('Erro ao enviar email de convite adicional:', emailError.message);
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[DEV] Link convite: ${link}`);
            }
        }

        console.log(`Convite adicionado ao round ${roundId} para ${inviteeEmail}.`);
        return { success: true, inviteId };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('addInviteToRound error:', error);
        return { success: false, message: 'Erro interno ao adicionar convite.' };
    }
}
