import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuTrophy, LuExternalLink, LuUserPlus, LuChartColumn, LuX, LuMailCheck } from 'react-icons/lu';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Button,
  ConfirmDialog,
  Banner,
  EmptyState,
  Modal,
  FormField,
} from '../../../components/ui/index.js';
import {
  QUOTATION_STATUS,
  QUOTATION_ROUND_STATUS,
  QUOTATION_INVITE_STATUS,
} from '../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { getQuotationRound, declareWinner, addInviteToRound, lookupSupplierForInvite, resendInvite } from '../api/quotationsApi.js';
import { formatCnpj } from '../../../utils/formatters.js';
import QuotationDetailModal from '../components/QuotationDetailModal/index.js';
import QuotationCompareModal from '../components/QuotationCompareModal/index.js';

export default function QuotationRoundPage() {
  const { roundId } = useParams();
  const { data: round, isLoading, reload } = useAsyncData(
    () => getQuotationRound(roundId),
    [roundId],
  );

  const confirmDialog    = useDisclosure(false);
  const detailModal      = useDisclosure(false);
  const inviteModal      = useDisclosure(false);
  const compareModal     = useDisclosure(false);
  const resendModal      = useDisclosure(false);

  const [candidate,    setCandidate]    = useState(null);
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [isDeciding,   setIsDeciding]   = useState(false);
  const [phase2Notice, setPhase2Notice] = useState(null);

  // Modo de comparação: seleção de cotações enviadas
  const [compareMode,     setCompareMode]     = useState(false);
  const [selectedQuotIds, setSelectedQuotIds] = useState([]);

  // Estado do modal "Convidar novo fornecedor"
  const [inviteMode,        setInviteMode]        = useState('email'); // 'email' | 'cnpj'
  const [newInviteEmail,    setNewInviteEmail]    = useState('');
  const [newInviteCnpj,     setNewInviteCnpj]     = useState('');
  const [isAddingInvite,    setIsAddingInvite]    = useState(false);
  const [inviteError,       setInviteError]       = useState('');
  const [inviteSuccess,     setInviteSuccess]     = useState(false);
  // Fornecedor encontrado no lookup (CNPJ + Razão Social, somente leitura)
  const [lookupSupplier,    setLookupSupplier]    = useState(null);
  const [isLookingUp,       setIsLookingUp]       = useState(false);

  // Estado do reenvio de convite (para fornecedores que ainda não responderam)
  const [resendTarget,   setResendTarget]   = useState(null);
  const [resendEmail,    setResendEmail]    = useState('');
  const [isResending,    setIsResending]    = useState(false);
  const [resendError,    setResendError]    = useState('');
  const [resendFeedback, setResendFeedback] = useState(null);

  if (isLoading) return null;
  if (!round)    return <EmptyState title="Rodada de cotação não encontrada" />;

  // Linhas da tabela: cada convite (i_*) com cotação opcional (q_*)
  const rows = round.invites ?? [];

  // Nº de cotações efetivamente enviadas (têm q_id) — habilita comparação
  const submittedCount = rows.filter((r) => r.q_id != null).length;

  const openConfirm = (row) => {
    setCandidate(row);
    confirmDialog.open();
  };

  const handleRowClick = (row) => {
    // Só abre detalhes se o fornecedor já enviou a cotação
    if (row.q_id == null) return;
    setSelectedRow(row);
    detailModal.open();
  };

  const handleConfirm = async () => {
    setIsDeciding(true);
    const result = await declareWinner(round.id, candidate.q_id);
    setIsDeciding(false);
    confirmDialog.close();

    if (result.success) {
      setPhase2Notice(result.body);
      reload();
    }
  };

  // Busca fornecedor cadastrado (mostra CNPJ + Razão Social somente leitura)
  const runSupplierLookup = async ({ email, cnpj }) => {
    setLookupSupplier(null);
    if ((email && email.includes('@')) || (cnpj && cnpj.replace(/\D/g, '').length === 14)) {
      setIsLookingUp(true);
      const result = await lookupSupplierForInvite({ email, cnpj });
      setIsLookingUp(false);
      setLookupSupplier(result.found ? result.supplier : null);
    }
  };

  const handleAddInvite = async () => {
    setInviteError('');

    const invitee = inviteMode === 'cnpj'
      ? { cnpj: newInviteCnpj.trim() }
      : { email: newInviteEmail.trim() };

    if (inviteMode === 'email' && !invitee.email) {
      setInviteError('Informe o e-mail do fornecedor.');
      return;
    }
    if (inviteMode === 'cnpj') {
      if (newInviteCnpj.replace(/\D/g, '').length !== 14) {
        setInviteError('Informe um CNPJ válido.');
        return;
      }
      if (!lookupSupplier) {
        setInviteError('CNPJ não encontrado na base. Para convite por CNPJ o fornecedor precisa estar cadastrado.');
        return;
      }
    }

    setIsAddingInvite(true);
    const result = await addInviteToRound(round.id, invitee);
    setIsAddingInvite(false);

    if (!result.success) {
      setInviteError(result.body?.message ?? 'Erro ao adicionar convite.');
      return;
    }

    setInviteSuccess(true);
    setNewInviteEmail('');
    setNewInviteCnpj('');
    reload();
  };

  const handleCloseInviteModal = () => {
    inviteModal.close();
    setInviteMode('email');
    setNewInviteEmail('');
    setNewInviteCnpj('');
    setInviteError('');
    setInviteSuccess(false);
    setLookupSupplier(null);
  };

  // ── Reenvio de convite ────────────────────────────────────────────────────
  const openResend = (row) => {
    setResendTarget(row);
    setResendEmail(row.i_invite_email ?? '');
    setResendError('');
    resendModal.open();
  };

  const closeResend = () => {
    resendModal.close();
    setResendTarget(null);
    setResendEmail('');
    setResendError('');
  };

  const handleResendConfirm = async () => {
    setResendError('');
    if (!resendEmail.trim() || !resendEmail.includes('@')) {
      setResendError('Confirme um e-mail válido para o reenvio.');
      return;
    }
    setIsResending(true);
    const result = await resendInvite(resendTarget.i_id, resendEmail.trim());
    setIsResending(false);

    if (!result.success) {
      setResendError(result.body?.message ?? 'Erro ao reenviar o convite.');
      return;
    }
    setResendFeedback(`Convite reenviado para ${result.body?.email ?? resendEmail.trim()}.`);
    closeResend();
  };

  // ── Comparação ──────────────────────────────────────────────────────────
  const toggleCompareMode = () => {
    setCompareMode((prev) => !prev);
    setSelectedQuotIds([]);
  };

  const toggleQuotSelection = (quotationId) => {
    setSelectedQuotIds((prev) =>
      prev.includes(quotationId)
        ? prev.filter((id) => id !== quotationId)
        : [...prev, quotationId],
    );
  };

  const columns = [
    // Coluna de seleção (apenas no modo comparação, para cotações enviadas)
    ...(compareMode
      ? [{
          key: 'compare_select',
          header: '',
          render: (row) =>
            row.q_id != null ? (
              <input
                type="checkbox"
                checked={selectedQuotIds.includes(row.q_id)}
                onChange={(e) => { e.stopPropagation(); toggleQuotSelection(row.q_id); }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Selecionar ${row.supplier_name ?? row.i_invite_email} para comparar`}
              />
            ) : null,
        }]
      : []),
    {
      key: 'supplier_name',
      header: 'Fornecedor',
      render: (row) => row.supplier_name ?? row.i_invite_email ?? '—',
    },
    {
      key: 'supplier_cnpj',
      header: 'CNPJ',
      render: (row) => (row.supplier_cnpj ? formatCnpj(row.supplier_cnpj) : '—'),
    },
    {
      key: 'i_status',
      header: 'Status do convite',
      render: (row) => (
        <StatusBadge enumMap={QUOTATION_INVITE_STATUS} value={row.i_status} />
      ),
    },
    {
      key: 'q_total_value',
      header: 'Valor proposto',
      render: (row) =>
        row.q_total_value != null ? formatCurrency(row.q_total_value) : '—',
    },
    {
      key: 'q_submitted_at',
      header: 'Enviado em',
      render: (row) =>
        row.q_submitted_at ? formatDateTime(row.q_submitted_at) : '—',
    },
    {
      key: 'q_status',
      header: 'Status da cotação',
      render: (row) =>
        row.q_status != null ? (
          <StatusBadge enumMap={QUOTATION_STATUS} value={row.q_status} />
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        // Botão "Declarar vencedor": rodada aberta + cotação submetida (q_status=1)
        if (round.status === 0 && row.q_status === 1) {
          return (
            <Button
              size="sm"
              variant="secondary"
              icon={LuTrophy}
              onClick={(e) => { e.stopPropagation(); openConfirm(row); }}
            >
              Declarar vencedor
            </Button>
          );
        }
        // Fornecedor ainda não enviou a proposta e a rodada está aberta:
        // permite reenviar o e-mail do convite.
        if (round.status === 0 && row.q_id == null) {
          return (
            <Button
              size="sm"
              variant="secondary"
              icon={LuMailCheck}
              onClick={(e) => { e.stopPropagation(); openResend(row); }}
            >
              Reenviar e-mail
            </Button>
          );
        }
        // Ícone de detalhe quando cotação existe mas a rodada já foi encerrada
        if (row.q_id != null) {
          return <LuExternalLink className="icon-muted" aria-hidden="true" />;
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos"
        title={`Rodada de cotação #${round.round_number ?? round.id}`}
        description={
          round.labor_request_title ??
          'Clique em uma linha com cotação enviada para ver os detalhes. Ao declarar o vencedor, o link da Fase 2 é enviado automaticamente.'
        }
        actions={
          <>
            <StatusBadge enumMap={QUOTATION_ROUND_STATUS} value={round.status} />
            {/* Só exibe o botão enquanto a rodada estiver aberta (status=0) */}
            {round.status === 0 && (
              <Button
                variant="secondary"
                icon={LuUserPlus}
                size="sm"
                onClick={inviteModal.open}
              >
                Convidar novo fornecedor
              </Button>
            )}
            {/* Comparação: disponível quando há ao menos 2 cotações enviadas */}
            {submittedCount >= 2 && (
              <Button
                variant={compareMode ? 'primary' : 'secondary'}
                icon={compareMode ? LuX : LuChartColumn}
                size="sm"
                onClick={toggleCompareMode}
              >
                {compareMode ? 'Cancelar comparação' : 'Comparar cotações'}
              </Button>
            )}
          </>
        }
      />

      {phase2Notice && (
        <Banner
          tone="success"
          title="Vencedor declarado"
          description={`E-mail com o link da Fase 2 enviado. O fornecedor tem ${
            round.deadline_hours ?? 72
          }h para enviar os documentos dos colaboradores.`}
        />
      )}

      {phase2Notice?.devPhase2Link && (
        <Banner
          tone="warning"
          title="[DEV] Link da Fase 2"
          description={phase2Notice.devPhase2Link}
        />
      )}

      {resendFeedback && (
        <Banner tone="success" description={resendFeedback} />
      )}

      {compareMode && (
        <Banner
          tone="info"
          title="Modo comparação"
          description={`Selecione as cotações que deseja comparar (${selectedQuotIds.length} selecionada(s)).`}
          actions={
            <Button
              size="sm"
              icon={LuChartColumn}
              disabled={selectedQuotIds.length < 2}
              onClick={compareModal.open}
            >
              Comparar selecionados
            </Button>
          }
        />
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.i_id}
        emptyTitle="Nenhum convite enviado ainda"
        /* Em modo comparação, o clique na linha não abre o detalhe */
        onRowClick={(row) => !compareMode && row.q_id != null && handleRowClick(row)}
      />

      {/* Modal de detalhes da cotação */}
      <QuotationDetailModal
        open={detailModal.isOpen}
        onClose={detailModal.close}
        row={selectedRow}
      />

      {/* Modal de comparação de cotações */}
      <QuotationCompareModal
        open={compareModal.isOpen}
        onClose={compareModal.close}
        roundId={round.id}
        quotationIds={selectedQuotIds}
      />

      {/* Confirmação de vencedor */}
      <ConfirmDialog
        open={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={handleConfirm}
        isLoading={isDeciding}
        title="Declarar vencedor"
        confirmLabel="Confirmar vencedor"
        description={
          candidate &&
          `Confirma ${candidate.supplier_name ?? candidate.i_invite_email} como vencedor por ${formatCurrency(candidate.q_total_value)}? Um prazo de 72h para envio dos documentos dos colaboradores será iniciado imediatamente.`
        }
      />

      {/* Modal de reenvio de convite — confirma o e-mail do destinatário */}
      <Modal
        open={resendModal.isOpen}
        onClose={closeResend}
        title="Reenviar convite"
        maxWidth="xs"
        actions={
          <>
            <Button variant="ghost" onClick={closeResend}>Cancelar</Button>
            <Button icon={LuMailCheck} isLoading={isResending} onClick={handleResendConfirm}>
              Confirmar e reenviar
            </Button>
          </>
        }
      >
        {resendTarget && (
          <>
            <p style={{ margin: '0 0 1rem', fontWeight: 700 }}>
              {resendTarget.supplier_name ?? resendTarget.i_invite_email}
              {resendTarget.supplier_cnpj && (
                <span style={{ fontWeight: 400, opacity: 0.75 }}> · {formatCnpj(resendTarget.supplier_cnpj)}</span>
              )}
            </p>
            <FormField
              label="E-mail do destinatário"
              hint={
                resendTarget.supplier_cnpj
                  ? 'Fornecedor cadastrado: confirme ou ajuste o e-mail (padrão: responsável operacional).'
                  : 'Confirme o e-mail para o qual o convite será reenviado.'
              }
              required
            >
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="email@fornecedor.com.br"
                autoFocus
              />
            </FormField>
            {resendError && (
              <div style={{ marginTop: '0.75rem' }}>
                <Banner tone="danger" description={resendError} />
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Modal de convite adicional */}
      <Modal
        open={inviteModal.isOpen}
        onClose={handleCloseInviteModal}
        title="Convidar novo fornecedor"
        maxWidth="xs"
        actions={
          <>
            <Button variant="ghost" onClick={handleCloseInviteModal}>
              Cancelar
            </Button>
            <Button
              icon={LuUserPlus}
              isLoading={isAddingInvite}
              onClick={handleAddInvite}
              disabled={inviteSuccess}
            >
              Enviar convite
            </Button>
          </>
        }
      >
        {inviteSuccess ? (
          <Banner
            tone="success"
            title="Convite enviado!"
            description={`O convite foi enviado. O fornecedor tem até ${formatDateTime(round.deadline)} para responder.`}
          />
        ) : (
          <>
            {/* Alternância: convidar por e-mail ou por CNPJ (já cadastrado) */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <Button
                size="sm"
                variant={inviteMode === 'email' ? 'primary' : 'secondary'}
                onClick={() => { setInviteMode('email'); setInviteError(''); setLookupSupplier(null); }}
              >
                Por e-mail
              </Button>
              <Button
                size="sm"
                variant={inviteMode === 'cnpj' ? 'primary' : 'secondary'}
                onClick={() => { setInviteMode('cnpj'); setInviteError(''); setLookupSupplier(null); }}
              >
                Por CNPJ
              </Button>
            </div>

            {inviteMode === 'email' ? (
              <FormField
                label="E-mail do fornecedor"
                hint={`O convite usa o mesmo prazo da rodada: ${formatDateTime(round.deadline)}.`}
                required
              >
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  onBlur={() => runSupplierLookup({ email: newInviteEmail.trim() })}
                  placeholder="email@fornecedor.com.br"
                  disabled={isAddingInvite}
                  autoFocus
                />
              </FormField>
            ) : (
              <FormField
                label="CNPJ do fornecedor"
                hint="O fornecedor precisa já estar cadastrado na base."
                required
              >
                <input
                  value={formatCnpj(newInviteCnpj)}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
                    setNewInviteCnpj(digits);
                    runSupplierLookup({ cnpj: digits });
                  }}
                  placeholder="00.000.000/0000-00"
                  disabled={isAddingInvite}
                  autoFocus
                />
              </FormField>
            )}

            {/* Prévia somente-leitura do fornecedor encontrado */}
            {isLookingUp && (
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.5rem 0 0' }}>Buscando fornecedor…</p>
            )}
            {lookupSupplier && (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem 0.9rem',
                borderRadius: '10px', background: 'rgba(47,158,68,0.10)',
                border: '1px solid rgba(47,158,68,0.4)',
              }}>
                <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.7 }}>
                  Fornecedor cadastrado
                </p>
                <p style={{ margin: '0.15rem 0 0', fontWeight: 700 }}>{lookupSupplier.razaoSocial}</p>
                <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.8 }}>
                  CNPJ: {formatCnpj(lookupSupplier.cnpj)}
                </p>
              </div>
            )}
            {inviteMode === 'email' && newInviteEmail.includes('@') && !isLookingUp && !lookupSupplier && (
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.5rem 0 0' }}>
                E-mail ainda não cadastrado — o convite será enviado por e-mail.
              </p>
            )}

            {inviteError && (
              <div style={{ marginTop: '0.75rem' }}>
                <Banner tone="danger" description={inviteError} />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
