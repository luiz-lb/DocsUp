import { useEffect, useState } from 'react';
import { LuSignature } from 'react-icons/lu';
import { Button, Modal } from '../../../../components/ui/index.js';
import styles from './AcceptanceTermDialog.module.css';

/**
 * Termo de aceite digital da declaração do contrato: o fornecedor confirma que o que declarou
 * é verdade e que sabe das consequências de omitir documentação. Ao assinar, ficam
 * registrados quem assinou, a data e a hora, o IP e o navegador.
 *
 * Props: open, onClose, onAccept, isSubmitting, hasMissingDocuments (avisa que o convite pausa)
 */
export default function AcceptanceTermDialog({ open, onClose, onAccept, isSubmitting, hasMissingDocuments = false }) {
  const [truthAck, setTruthAck] = useState(false);
  const [omissionAck, setOmissionAck] = useState(false);

  // Cada abertura começa desmarcada
  useEffect(() => {
    if (open) {
      setTruthAck(false);
      setOmissionAck(false);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title="Termo de aceite digital"
      maxWidth="sm"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Voltar e revisar</Button>
          <Button icon={LuSignature} disabled={!truthAck || !omissionAck} isLoading={isSubmitting} onClick={onAccept}>
            Assinar e enviar declaração
          </Button>
        </>
      }
    >
      <p className={styles.paragraph}>
        Ao assinar, ficam registrados nesta declaração o seu nome, a data e a hora, o IP e o navegador,
        com validade de aceite digital.
      </p>

      {hasMissingDocuments && (
        <p className={styles.warning}>
          Você informou que a empresa não tem um documento exigido. O convite fica pausado e o setor de
          Compras é avisado para decidir os próximos passos.
        </p>
      )}

      <label className={styles.checkRow}>
        <input type="checkbox" checked={truthAck} onChange={(event) => setTruthAck(event.target.checked)} />
        <span>
          Declaro que as informações sobre os documentos da empresa e a quantidade de funcionários com cada
          documento são verdadeiras.
        </span>
      </label>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={omissionAck} onChange={(event) => setOmissionAck(event.target.checked)} />
        <span>
          Estou ciente de que a omissão de documentação obrigatória pode causar atraso no pagamento e até a
          mudança ou o cancelamento do contrato.
        </span>
      </label>
    </Modal>
  );
}
