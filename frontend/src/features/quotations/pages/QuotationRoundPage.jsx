import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuTrophy } from 'react-icons/lu';
import { PageHeader, DataTable, StatusBadge, Button, ConfirmDialog, Banner, EmptyState } from '../../../components/ui/index.js';
import { QUOTATION_STATUS, QUOTATION_ROUND_STATUS } from '../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { getQuotationRound, declareWinner } from '../api/quotationsApi.js';

export default function QuotationRoundPage() {
  const { roundId } = useParams();
  const { data: round, isLoading, reload } = useAsyncData(() => getQuotationRound(roundId), [roundId]);
  const confirmDialog = useDisclosure(false);
  const [candidate, setCandidate] = useState(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const [phase2Notice, setPhase2Notice] = useState(false);

  if (isLoading) return null;
  if (!round) return <EmptyState title="Rodada de cotacao nao encontrada" />;

  const openConfirm = (quotation) => {
    setCandidate(quotation);
    confirmDialog.open();
  };

  const handleConfirm = async () => {
    setIsDeciding(true);
    await declareWinner(round.id, candidate.id);
    setIsDeciding(false);
    confirmDialog.close();
    setPhase2Notice(true);
    reload();
  };

  const columns = [
    { key: 'supplierName', header: 'Fornecedor' },
    { key: 'totalValue', header: 'Valor', render: (row) => formatCurrency(row.totalValue) },
    { key: 'submittedAt', header: 'Enviado em', render: (row) => formatDateTime(row.submittedAt) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={QUOTATION_STATUS} value={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        round.status === 0 && row.status === 1 ? (
          <Button size="sm" variant="secondary" icon={LuTrophy} onClick={() => openConfirm(row)}>
            Declarar vencedor
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos"
        title={`Rodada de cotacao #${round.id}`}
        description="Menor valor no topo. Ao declarar o vencedor, o link da Fase 2 (colaboradores) e' enviado automaticamente."
        actions={<StatusBadge enumMap={QUOTATION_ROUND_STATUS} value={round.status} />}
      />

      {phase2Notice && (
        <Banner
          tone="success"
          title="Vencedor declarado"
          description="E-mail com o link da Fase 2 enviado. Prazo de 72h iniciado para envio dos colaboradores."
        />
      )}

      <DataTable columns={columns} rows={round.quotations} emptyTitle="Nenhuma cotacao recebida ainda" />

      <ConfirmDialog
        open={confirmDialog.isOpen}
        onClose={confirmDialog.close}
        onConfirm={handleConfirm}
        isLoading={isDeciding}
        title="Declarar vencedor"
        confirmLabel="Confirmar vencedor"
        description={candidate && `Confirma ${candidate.supplierName} como vencedor por ${formatCurrency(candidate.totalValue)}? Um prazo de 72h para envio dos colaboradores sera iniciado.`}
      />
    </div>
  );
}
