import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuTrophy } from 'react-icons/lu';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Button,
  ConfirmDialog,
  Banner,
  EmptyState,
} from '../../../components/ui/index.js';
import { QUOTATION_STATUS, QUOTATION_ROUND_STATUS } from '../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { getQuotationRound, declareWinner } from '../api/quotationsApi.js';

export default function QuotationRoundPage() {
  const { roundId } = useParams();
  const { data: round, isLoading, reload } = useAsyncData(
    () => getQuotationRound(roundId),
    [roundId],
  );
  const confirmDialog = useDisclosure(false);
  const [candidate, setCandidate] = useState(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const [phase2Notice, setPhase2Notice] = useState(null); // { expiresAt, devPhase2Link? }

  if (isLoading) return null;
  if (!round) return <EmptyState title="Rodada de cotação não encontrada" />;

  const openConfirm = (quotation) => {
    setCandidate(quotation);
    confirmDialog.open();
  };

  const handleConfirm = async () => {
    setIsDeciding(true);
    const result = await declareWinner(round.id, candidate.id);
    setIsDeciding(false);
    confirmDialog.close();

    if (result.success) {
      setPhase2Notice(result.body);
      reload();
    }
  };

  const columns = [
    { key: 'ranking', header: '#', width: '3rem' },
    { key: 'supplier_name', header: 'Fornecedor' },
    {
      key: 'total_value',
      header: 'Valor',
      render: (row) => formatCurrency(row.total_value),
    },
    {
      key: 'submitted_at',
      header: 'Enviado em',
      render: (row) => formatDateTime(row.submitted_at),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge enumMap={QUOTATION_STATUS} value={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        round.status === 0 && row.status === 1 ? (
          <Button
            size="sm"
            variant="secondary"
            icon={LuTrophy}
            onClick={() => openConfirm(row)}
          >
            Declarar vencedor
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos"
        title={`Rodada de cotação #${round.round_number ?? round.id}`}
        description={round.labor_request_title ?? 'Menor valor no topo. Ao declarar o vencedor, o link da Fase 2 é enviado automaticamente.'}
        actions={<StatusBadge enumMap={QUOTATION_ROUND_STATUS} value={round.status} />}
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

      {/* Em dev, exibe o link da Fase 2 diretamente na tela */}
      {phase2Notice?.devPhase2Link && (
        <Banner
          tone="warning"
          title="[DEV] Link da Fase 2"
          description={phase2Notice.devPhase2Link}
        />
      )}

      <DataTable
        columns={columns}
        rows={round.quotations ?? []}
        emptyTitle="Nenhuma cotação recebida ainda"
      />

      <ConfirmDialog
        open={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={handleConfirm}
        isLoading={isDeciding}
        title="Declarar vencedor"
        confirmLabel="Confirmar vencedor"
        description={
          candidate &&
          `Confirma ${candidate.supplier_name} como vencedor por ${formatCurrency(candidate.total_value)}? Um prazo de 72h para envio dos documentos dos colaboradores será iniciado imediatamente.`
        }
      />
    </div>
  );
}
