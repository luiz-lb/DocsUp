import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuTrophy, LuExternalLink, LuUserPlus } from 'react-icons/lu';
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
import { getQuotationRound, declareWinner, addInviteToRound } from '../api/quotationsApi.js';
import QuotationDetailModal from '../components/QuotationDetailModal/index.js';

export default function QuotationRoundPage() {
  const { roundId } = useParams();
  const { data: round, isLoading, reload } = useAsyncData(
    () => getQuotationRound(roundId),
    [roundId],
  );

  const confirmDialog    = useDisclosure(false);
  const detailModal      = useDisclosure(false);
  const inviteModal      = useDisclosure(false);

  const [candidate,    setCandidate]    = useState(null);
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [isDeciding,   setIsDeciding]   = useState(false);
  const [phase2Notice, setPhase2Notice] = useState(null);

  // Estado do modal "Convidar novo fornecedor"
  const [newInviteEmail,    setNewInviteEmail]    = useState('');
  const [isAddingInvite,    setIsAddingInvite]    = useState(false);
  const [inviteError,       setInviteError]       = useState('');
  const [inviteSuccess,     setInviteSuccess]     = useState(false);

  if (isLoading) return null;
  if (!round)    return <EmptyState title="Rodada de cotação não encontrada" />;

  // Linhas da tabela: cada convite (i_*) com cotação opcional (q_*)
  const rows = round.invites ?? [];

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

  const handleAddInvite = async () => {
    setInviteError('');
    if (!newInviteEmail.trim()) {
      setInviteError('Informe o e-mail do fornecedor.');
      return;
    }

    setIsAddingInvite(true);
    const result = await addInviteToRound(round.id, newInviteEmail.trim());
    setIsAddingInvite(false);

    if (!result.success) {
      setInviteError(result.body?.message ?? 'Erro ao adicionar convite.');
      return;
    }

    setInviteSuccess(true);
    setNewInviteEmail('');
    reload();
  };

  const handleCloseInviteModal = () => {
    inviteModal.close();
    setNewInviteEmail('');
    setInviteError('');
    setInviteSuccess(false);
  };

  const columns = [
    {
      key: 'supplier_name',
      header: 'Fornecedor',
      render: (row) => row.supplier_name ?? row.i_invite_email ?? '—',
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

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.i_id}
        emptyTitle="Nenhum convite enviado ainda"
        /* Linha clicável apenas quando há cotação (q_id preenchido) */
        onRowClick={(row) => row.q_id != null && handleRowClick(row)}
      />

      {/* Modal de detalhes da cotação */}
      <QuotationDetailModal
        open={detailModal.isOpen}
        onClose={detailModal.close}
        row={selectedRow}
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
            description={`O e-mail de convite foi enviado. O fornecedor tem até ${formatDateTime(round.deadline)} para responder.`}
          />
        ) : (
          <>
            <FormField
              label="E-mail do fornecedor"
              hint={`O convite usa o mesmo prazo da rodada: ${formatDateTime(round.deadline)}.`}
              required
            >
              <input
                type="email"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="email@fornecedor.com.br"
                disabled={isAddingInvite}
                autoFocus
              />
            </FormField>
            {inviteError && (
              <Banner tone="danger" description={inviteError} />
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
