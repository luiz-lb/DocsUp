import { useState } from 'react';
import { LuBuilding2, LuFilePen, LuUsers } from 'react-icons/lu';
import { Banner, Button } from '../../../../components/ui/index.js';
import { cn } from '../../../../utils/cn.js';
import { submitDeclaration } from '../../../employees/api/employeesApi.js';
import AcceptanceTermDialog from '../AcceptanceTermDialog/index.js';
import styles from './ContractDeclaration.module.css';

const MAX_EMPLOYEES = 100000;

/**
 * Declaração do contrato (antes de enviar documentos):
 *  - documentos da empresa exigidos: a empresa tem ou não tem cada um;
 *  - documentos de colaborador exigidos (NRs e outros): quantos funcionários têm cada um
 *    (no mínimo 1);
 * e o termo de aceite assinado. Faltando documento da empresa, o convite pausa e Compras é
 * avisado.
 *
 * Props: token, items ({ company: [{ id, name }], employee: [{ id, name, code }] }), onDone(result)
 */
export default function ContractDeclaration({ token, items, onDone }) {
  const company = items?.company ?? [];
  const employee = items?.employee ?? [];

  const [hasDocument, setHasDocument] = useState({}); // { [id]: true | false }
  const [counts, setCounts] = useState({}); // { [id]: '3' }
  const [termOpen, setTermOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const missing = company.filter((item) => hasDocument[item.id] === false);

  const validate = () => {
    const unanswered = company.filter((item) => typeof hasDocument[item.id] !== 'boolean');
    if (unanswered.length > 0) return `Responda se a empresa tem: ${unanswered.map((item) => item.name).join(', ')}.`;
    for (const item of employee) {
      const value = Number(counts[item.id]);
      if (!Number.isInteger(value) || value < 1 || value > MAX_EMPLOYEES) {
        return `Informe quantos funcionários têm "${item.name}" (no mínimo 1).`;
      }
    }
    return null;
  };

  const openTerm = () => {
    const validationError = validate();
    setError(validationError ?? '');
    if (!validationError) setTermOpen(true);
  };

  const handleAccept = async () => {
    setIsSubmitting(true);
    const result = await submitDeclaration(token, {
      termAccepted: true,
      companyDocuments: company.map((item) => ({ documentTypeId: item.id, hasDocument: hasDocument[item.id] })),
      employeeDocuments: employee.map((item) => ({ documentTypeId: item.id, employeeCount: Number(counts[item.id]) })),
    });
    setIsSubmitting(false);

    if (!result.success) {
      setTermOpen(false);
      setError(result.body?.message ?? 'Erro ao enviar a declaração.');
      return;
    }
    setTermOpen(false);
    onDone?.(result.body);
  };

  return (
    <div className={styles.wrapper}>
      <Banner
        tone="info"
        title="Antes de enviar os documentos"
        description="Informe quais documentos a empresa tem e quantos funcionários têm cada documento exigido. Depois, assine o termo de aceite."
      />

      {company.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.title}><LuBuilding2 aria-hidden="true" /> Documentos da empresa</h3>
          <p className={styles.note}>A empresa precisa ter todos. Se faltar algum, o convite fica pausado até o setor de Compras decidir.</p>
          <div className={styles.list}>
            {company.map((item) => (
              <div key={item.id} className={styles.row}>
                <span className={styles.name}>{item.name}</span>
                <div className={styles.toggle} role="group" aria-label={item.name}>
                  <button
                    type="button"
                    className={cn(styles.option, hasDocument[item.id] === true && styles.yes)}
                    onClick={() => setHasDocument((prev) => ({ ...prev, [item.id]: true }))}
                    aria-pressed={hasDocument[item.id] === true}
                  >
                    Tenho
                  </button>
                  <button
                    type="button"
                    className={cn(styles.option, hasDocument[item.id] === false && styles.no)}
                    onClick={() => setHasDocument((prev) => ({ ...prev, [item.id]: false }))}
                    aria-pressed={hasDocument[item.id] === false}
                  >
                    Não tenho
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {employee.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.title}><LuUsers aria-hidden="true" /> Documentos dos colaboradores</h3>
          <p className={styles.note}>
            Quantos dos seus funcionários têm cada documento exigido? No mínimo 1. Os documentos básicos
            (ASO, Ficha de EPI…) valem para todos e não entram aqui.
          </p>
          <div className={styles.list}>
            {employee.map((item) => (
              <label key={item.id} className={styles.row}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.countField}>
                  <input
                    type="number"
                    min="1"
                    max={MAX_EMPLOYEES}
                    step="1"
                    inputMode="numeric"
                    value={counts[item.id] ?? ''}
                    onChange={(event) => setCounts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder="0"
                    aria-label={`Funcionários com ${item.name}`}
                  />
                  <span className={styles.countSuffix}>funcionários</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {company.length === 0 && employee.length === 0 && (
        <p className={styles.note}>Esta solicitação não tem documentos a declarar. Assine o termo para liberar o envio.</p>
      )}

      {missing.length > 0 && (
        <Banner
          tone="warning"
          description={`A empresa não tem: ${missing.map((item) => item.name).join(', ')}. Ao enviar, o convite fica pausado e o setor de Compras é avisado.`}
        />
      )}
      {error && <Banner tone="danger" description={error} />}

      <div className={styles.actions}>
        <Button icon={LuFilePen} onClick={openTerm}>
          Revisar e assinar o termo
        </Button>
      </div>

      <AcceptanceTermDialog
        open={termOpen}
        onClose={() => setTermOpen(false)}
        onAccept={handleAccept}
        isSubmitting={isSubmitting}
        hasMissingDocuments={missing.length > 0}
      />
    </div>
  );
}
