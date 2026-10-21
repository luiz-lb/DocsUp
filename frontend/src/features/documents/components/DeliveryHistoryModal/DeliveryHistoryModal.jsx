import { useEffect, useState } from 'react';
import { Modal, Button, Banner } from '../../../../components/ui/index.js';
import { downloadDocumentFiles, getDocumentHistory } from '../../api/documentsRealApi.js';
import DeliveryHistoryTable from '../DeliveryHistoryTable/index.js';
import styles from './DeliveryHistoryModal.module.css';

/**
 * Histórico de entregas de um documento (visão do RH / Segurança), com o download de
 * cada arquivo e quem analisou cada entrega.
 *
 * Props:
 *  - open     : boolean
 *  - document : linha da lista (id, document_type_name, employee_name, supplier_name...)
 *  - onClose  : () => void
 */
export default function DeliveryHistoryModal({ open, document, onClose }) {
  const [state, setState] = useState({ isLoading: false, deliveries: [], error: '' });
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!open || !document) return undefined;
    let cancelled = false;
    setState({ isLoading: true, deliveries: [], error: '' });
    setDownloadError('');
    getDocumentHistory(document.id).then((result) => {
      if (cancelled) return;
      setState({
        isLoading: false,
        deliveries: result.success ? result.body : [],
        error: result.success ? '' : result.body?.message ?? 'Erro ao buscar o histórico.',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, document]);

  const handleDownload = async (delivery) => {
    setDownloadingId(delivery.id);
    setDownloadError('');
    const result = await downloadDocumentFiles([delivery.id]);
    setDownloadingId(null);
    if (!result.success) setDownloadError(result.body?.message ?? 'Erro ao baixar o arquivo.');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Histórico de entregas"
      maxWidth="md"
      actions={<Button variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <div className={styles.content}>
        {document && (
          <p className={styles.subtitle}>
            <strong>{document.document_type_name}</strong>
            {document.employee_name ? ` · ${document.employee_name}` : ' · Empresa'}
            {document.supplier_name && <span className={styles.supplier}>{document.supplier_name}</span>}
          </p>
        )}

        {state.error && <Banner tone="danger" description={state.error} />}
        {downloadError && <Banner tone="danger" description={downloadError} />}

        {state.isLoading ? (
          <p className={styles.loading}>Carregando histórico…</p>
        ) : (
          !state.error && (
            <DeliveryHistoryTable
              deliveries={state.deliveries}
              onDownload={handleDownload}
              downloadingId={downloadingId}
              showReviewer
            />
          )
        )}
      </div>
    </Modal>
  );
}
