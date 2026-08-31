import { useState } from 'react';
import { LuSignature } from 'react-icons/lu';
import Modal from '../../../../components/ui/Modal/index.js';
import Button from '../../../../components/ui/Button/index.js';
import styles from './AcceptanceTermDialog.module.css';

/**
 * Termo de Aceite digital exigido antes do envio da cotacao: o fornecedor
 * confirma que a documentacao declarada e' verdadeira e ciencia de que a
 * omissao pode gerar atraso no pagamento ou quebra de contrato. Ao confirmar,
 * o registro leva IP + data/hora (submitQuotation grava isso no backend mock).
 */
export default function AcceptanceTermDialog({ open, onClose, onAccept, isSubmitting }) {
  const [checklistAck, setChecklistAck] = useState(false);
  const [omissionAck, setOmissionAck] = useState(false);

  const canAccept = checklistAck && omissionAck;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Termo de Aceite Digital"
      maxWidth="sm"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Voltar e revisar</Button>
          <Button icon={LuSignature} disabled={!canAccept} isLoading={isSubmitting} onClick={onAccept}>
            Assinar e enviar cotacao
          </Button>
        </>
      }
    >
      <p className={styles.paragraph}>
        Ao assinar este termo, ficara registrado nesta cotacao o seu IP e o horario exato da confirmacao,
        com validade de aceite digital.
      </p>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={checklistAck} onChange={(event) => setChecklistAck(event.target.checked)} />
        <span>Declaro que as informacoes de documentacao da empresa preenchidas nesta cotacao sao verdadeiras.</span>
      </label>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={omissionAck} onChange={(event) => setOmissionAck(event.target.checked)} />
        <span>
          Estou ciente de que a omissao de documentacao obrigatoria pode causar atraso no pagamento e ate
          mudanca ou cancelamento do contrato.
        </span>
      </label>
    </Modal>
  );
}
