import { useState } from 'react';
import { LuCheck, LuCopy, LuMail, LuRefreshCw, LuRepeat, LuTimer, LuTruck } from 'react-icons/lu';
import { Banner, Button, Card, CountdownTimer, StatusBadge } from '../../../../components/ui/index.js';
import {
  ASSIGNMENT_END_REASON,
  ASSIGNMENT_STATUS,
  ASSIGNMENT_STATUS_ID,
  DOCUMENT_CATEGORY_ID,
  LABOR_REQUEST_STATUS_ID,
} from '../../../../constants/enums.js';
import { useAsyncData } from '../../../../hooks/useAsyncData.js';
import { formatCnpj, formatDateTime } from '../../../../utils/formatters.js';
import { getRequestSupplier } from '../../api/laborRequestsApi.js';
import SupplierInviteModal from '../SupplierInviteModal/index.js';
import styles from './SupplierAssignmentCard.module.css';

/**
 * Fornecedor da solicitação (no lugar da cotação). Compras (Suprimentos / Admin) indica o
 * fornecedor pelo e-mail com o prazo dos documentos, reenvia o convite, muda o prazo e troca o
 * fornecedor. Os outros perfis só acompanham. Mostra a declaração assinada pelo fornecedor
 * (o que a empresa tem e quantos funcionários têm cada documento) e o histórico.
 *
 * Props: laborRequestId, requestStatus, onChanged (recarrega a solicitação)
 */
export default function SupplierAssignmentCard({ laborRequestId, requestStatus, onChanged }) {
  const { data: response, isLoading, reload } = useAsyncData(() => getRequestSupplier(laborRequestId), [laborRequestId]);
  const [modalMode, setModalMode] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [copied, setCopied] = useState(false);

  if (isLoading && !response) return null;
  if (!response?.success) {
    return <Banner tone="danger" description={response?.body?.message ?? 'Erro ao buscar o fornecedor.'} />;
  }

  const { current, declaration = [], history = [], canManage, mailEnabled } = response.body;

  const handleSuccess = (message) => {
    setModalMode(null);
    setFeedback({ tone: 'success', message });
    reload();
    onChanged?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(current.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const isClosed = [LABOR_REQUEST_STATUS_ID.CONCLUIDA, LABOR_REQUEST_STATUS_ID.CANCELADA].includes(requestStatus);
  const companyDeclaration = declaration.filter((row) => row.category === DOCUMENT_CATEGORY_ID.EMPRESA);
  const employeeDeclaration = declaration.filter((row) => row.category !== DOCUMENT_CATEGORY_ID.EMPRESA);
  const missingCompany = companyDeclaration.filter((row) => row.has_document === false);

  return (
    <Card>
      <Card.Body>
        <div className={styles.header}>
          <h3 className={styles.title}><LuTruck aria-hidden="true" /> Fornecedor</h3>
          {current && <StatusBadge enumMap={ASSIGNMENT_STATUS} value={current.status} />}
        </div>

        {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

        {/* ── Ainda sem fornecedor ── */}
        {!current && (
          requestStatus === LABOR_REQUEST_STATUS_ID.AGUARDANDO_FORNECEDOR ? (
            canManage ? (
              <div className={styles.empty}>
                <p>Solicitação aprovada. Indique o fornecedor pelo e-mail e defina o prazo dos documentos iniciais.</p>
                <Button icon={LuMail} onClick={() => setModalMode('assign')}>Indicar fornecedor</Button>
              </div>
            ) : (
              <p className={styles.muted}>Aguardando o setor de Compras indicar o fornecedor.</p>
            )
          ) : (
            <p className={styles.muted}>Nenhum fornecedor indicado.</p>
          )
        )}

        {/* ── Fornecedor atual ── */}
        {current && (
          <>
            <dl className={styles.grid}>
              <dt>Empresa</dt>
              <dd>
                {current.supplierName ? (
                  <>
                    <strong>{current.supplierName}</strong>
                    {current.supplierCnpj && <span className={styles.meta}>CNPJ {formatCnpj(current.supplierCnpj)}</span>}
                  </>
                ) : (
                  <span className={styles.meta}>Ainda sem cadastro no portal</span>
                )}
              </dd>

              <dt>E-mail do convite</dt>
              <dd>{current.inviteEmail}</dd>

              <dt>Prazo dos documentos</dt>
              <dd className={styles.deadline}>
                <span>{formatDateTime(current.deadlineAt)}</span>
                {current.status !== ASSIGNMENT_STATUS_ID.BLOQUEADO && (
                  <CountdownTimer deadline={current.deadlineAt} expiredLabel="Prazo encerrado" />
                )}
              </dd>

              <dt>Indicado</dt>
              <dd>
                {formatDateTime(current.createdAt)}
                {current.createdByName ? ` · ${current.createdByName}` : ''}
              </dd>

              <dt>Declaração</dt>
              <dd>
                {current.declaredAt
                  ? `Assinada em ${formatDateTime(current.declaredAt)}${current.declaredByName ? ` por ${current.declaredByName}` : ''}${current.acceptanceIp ? ` (IP ${current.acceptanceIp})` : ''}`
                  : 'Ainda não assinada'}
              </dd>
            </dl>

            {current.status === ASSIGNMENT_STATUS_ID.BLOQUEADO && (
              <Banner
                tone="danger"
                title="Convite pausado: o fornecedor não tem documento da empresa"
                description={`Falta: ${missingCompany.map((row) => row.document_type_name).join(', ') || '—'}. Reenvie o convite para o mesmo e-mail (recomeça do zero) ou troque o fornecedor.`}
              />
            )}
            {current.status === ASSIGNMENT_STATUS_ID.AGUARDANDO && !current.supplierId && (
              <Banner
                tone="info"
                description="O e-mail ainda não tem cadastro. Quando a empresa se cadastrar (pelo link ou com este e-mail), a solicitação aparece no portal dela."
              />
            )}

            {declaration.length > 0 && (
              <div className={styles.declaration}>
                {companyDeclaration.length > 0 && (
                  <div>
                    <p className={styles.declTitle}>Documentos da empresa</p>
                    <ul className={styles.declList}>
                      {companyDeclaration.map((row) => (
                        <li key={row.document_type_id}>
                          <span>{row.document_type_name}</span>
                          <StatusBadge
                            label={row.has_document ? 'Tem' : 'Não tem'}
                            tone={row.has_document ? 'success' : 'danger'}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {employeeDeclaration.length > 0 && (
                  <div>
                    <p className={styles.declTitle}>Colaboradores com o documento</p>
                    <ul className={styles.declList}>
                      {employeeDeclaration.map((row) => (
                        <li key={row.document_type_id}>
                          <span>{row.document_type_name}</span>
                          <strong>{row.employee_count}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {canManage && current.inviteLink && current.status !== ASSIGNMENT_STATUS_ID.BLOQUEADO && (
              <div className={styles.linkBox}>
                <span className={styles.meta}>
                  {mailEnabled
                    ? 'Link do convite (também enviado por e-mail):'
                    : 'Envio de e-mail desligado: envie este link ao fornecedor.'}
                </span>
                <div className={styles.linkRow}>
                  <input className={styles.linkInput} value={current.inviteLink} readOnly onFocus={(event) => event.target.select()} />
                  <Button size="sm" variant="secondary" icon={copied ? LuCheck : LuCopy} onClick={handleCopy}>
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            )}

            {/* Contrato concluído ou cancelado: sem troca de fornecedor nem de prazo */}
            {canManage && !isClosed && (
              <div className={styles.actions}>
                {[ASSIGNMENT_STATUS_ID.AGUARDANDO, ASSIGNMENT_STATUS_ID.BLOQUEADO].includes(current.status) && (
                  <Button size="sm" variant="secondary" icon={LuRefreshCw} onClick={() => setModalMode('resend')}>
                    {current.status === ASSIGNMENT_STATUS_ID.BLOQUEADO ? 'Reenviar para o mesmo e-mail' : 'Reenviar convite'}
                  </Button>
                )}
                {current.status !== ASSIGNMENT_STATUS_ID.BLOQUEADO && (
                  <Button size="sm" variant="secondary" icon={LuTimer} onClick={() => setModalMode('deadline')}>
                    Mudar prazo
                  </Button>
                )}
                {/* Ex.: o fornecedor não está entregando os documentos ou não está apto */}
                <Button size="sm" variant="ghost" icon={LuRepeat} onClick={() => setModalMode('replace')}>
                  Trocar fornecedor
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── Histórico ── */}
        {history.length > 0 && (
          <details className={styles.history}>
            <summary>Fornecedores anteriores ({history.length})</summary>
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.supplierName ?? item.inviteEmail}</strong>
                    {item.supplierName && <span className={styles.meta}> · {item.inviteEmail}</span>}
                  </div>
                  <span className={styles.meta}>
                    {formatDateTime(item.createdAt)} → {formatDateTime(item.endedAt)}
                    {' · '}{ASSIGNMENT_END_REASON[item.endReason]?.label ?? 'Encerrado'}
                    {item.endedByName ? ` por ${item.endedByName}` : ''}
                  </span>
                  {item.endComment && <span className={styles.reason}>Motivo: {item.endComment}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card.Body>

      <SupplierInviteModal
        open={Boolean(modalMode)}
        mode={modalMode ?? 'assign'}
        laborRequestId={laborRequestId}
        currentEmail={current?.inviteEmail}
        onClose={() => setModalMode(null)}
        onSuccess={handleSuccess}
      />
    </Card>
  );
}
