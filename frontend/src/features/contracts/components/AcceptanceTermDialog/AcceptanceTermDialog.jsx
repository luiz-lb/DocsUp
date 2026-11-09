import { useEffect, useState } from 'react';
import { LuSignature } from 'react-icons/lu';
import { Button, Modal } from '../../../../components/ui/index.js';
import styles from './AcceptanceTermDialog.module.css';

// Texto padrão (o mesmo do backend), usado se a API não mandar o termo
const DEFAULT_TERM = {
  intro: 'Ao assinar, ficam registrados nesta declaração o nome de quem assinou, a data e a hora, o IP e o navegador, com validade de aceite digital.',
  statements: [
    'Declaro que as informações sobre os documentos da empresa e a quantidade de funcionários com cada documento são verdadeiras.',
    'Estou ciente de que a omissão de documentação obrigatória pode causar atraso no pagamento e até a mudança ou o cancelamento do contrato.',
  ],
};

/**
 * Termo de aceite digital da declaração do contrato: o fornecedor confirma que o que declarou
 * é verdade e que sabe das consequências de omitir documentação. O texto vem da API (o mesmo
 * que fica guardado na assinatura e sai no PDF). Ao assinar, ficam registrados quem assinou,
 * a data e a hora, o IP e o navegador.
 *
 * Props: open, onClose, onAccept, isSubmitting, hasMissingDocuments (avisa que o convite pausa),
 *        term ({ version, intro, statements[] }, opcional)
 */
export default function AcceptanceTermDialog({ open, onClose, onAccept, isSubmitting, hasMissingDocuments = false, term }) {
  const content = term?.statements?.length ? term : DEFAULT_TERM;
  const [acks, setAcks] = useState([]);

  // Cada abertura começa desmarcada
  useEffect(() => {
    if (open) setAcks(content.statements.map(() => false));
  }, [open, content.statements]);

  const allChecked = acks.length === content.statements.length && acks.every(Boolean);

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title="Termo de aceite digital"
      maxWidth="sm"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Voltar e revisar</Button>
          <Button icon={LuSignature} disabled={!allChecked} isLoading={isSubmitting} onClick={onAccept}>
            Assinar e enviar declaração
          </Button>
        </>
      }
    >
      <p className={styles.paragraph}>{content.intro}</p>

      {hasMissingDocuments && (
        <p className={styles.warning}>
          Você informou que a empresa não tem um documento exigido. O convite fica pausado e o setor de
          Compras é avisado para decidir os próximos passos.
        </p>
      )}

      {content.statements.map((statement, index) => (
        <label key={statement} className={styles.checkRow}>
          <input
            type="checkbox"
            checked={Boolean(acks[index])}
            onChange={(event) => setAcks((prev) => prev.map((value, i) => (i === index ? event.target.checked : value)))}
          />
          <span>{statement}</span>
        </label>
      ))}

      <p className={styles.paragraph}>
        Depois de assinar, a declaração fica disponível em PDF no contrato (para a sua empresa e para a contratante).
      </p>
    </Modal>
  );
}
