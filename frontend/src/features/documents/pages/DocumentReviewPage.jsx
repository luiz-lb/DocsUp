import { useState } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';
import { Card, PageHeader, Button, EmptyState, Banner } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listReviewQueue, reviewDocument } from '../api/documentsApi.js';
import AiValidationResultCard from '../components/AiValidationResultCard/index.js';
import styles from './DocumentReviewPage.module.css';

export default function DocumentReviewPage() {
  const { data: queue, isLoading, reload } = useAsyncData(listReviewQueue, []);
  const [decidingId, setDecidingId] = useState(null);

  const decide = async (documentId, decision) => {
    setDecidingId(documentId);
    await reviewDocument(documentId, decision, decision === 1 ? 'Aprovado apos revisao manual.' : 'Reprovado apos revisao manual.');
    setDecidingId(null);
    reload();
  };

  if (isLoading) return null;

  return (
    <div>
      <PageHeader
        eyebrow="RH & Seguranca"
        title="Fila de revisao manual"
        description="Documentos com score de IA abaixo de 85 caem aqui para decisao humana."
      />

      {queue.length === 0 ? (
        <EmptyState title="Fila vazia" description="Nenhum documento aguardando revisao manual no momento." />
      ) : (
        <div className={styles.list}>
          {queue.map((doc) => (
            <Card key={doc.id}>
              <Card.Body>
                <div className={styles.headerRow}>
                  <div>
                    <strong>{doc.documentTypeName}</strong>
                    <div className={styles.meta}>{doc.supplierName} · {doc.fileName}</div>
                  </div>
                </div>

                <Banner tone="warning" description="Score de IA abaixo do limite de confianca (85). Revise os pontos antes de decidir." />

                <div className={styles.resultSpacer}>
                  <AiValidationResultCard score={doc.aiScore} checklist={doc.aiChecklist} />
                </div>
              </Card.Body>
              <Card.Footer>
                <Button variant="danger" icon={LuX} isLoading={decidingId === doc.id} onClick={() => decide(doc.id, 2)}>
                  Reprovar
                </Button>
                <Button icon={LuCheck} isLoading={decidingId === doc.id} onClick={() => decide(doc.id, 1)}>
                  Aprovar
                </Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
