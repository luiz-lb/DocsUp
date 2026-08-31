import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuUserPlus } from 'react-icons/lu';
import { Card, Button, FormField, FileDropzone, StatusBadge } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../constants/enums.js';
import { NR_TYPES } from '../../../mocks/catalog.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getPhase2ByToken, addEmployee } from '../api/employeesApi.js';
import Phase2CountdownBanner from '../components/Phase2CountdownBanner/index.js';
import NrBadgeList from '../components/NrBadgeList/index.js';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './Phase2UploadPage.module.css';

const EMPTY_EMPLOYEE = { fullName: '', cpf: '', roleFunction: '', nrIds: [] };

export default function Phase2UploadPage() {
  const { token } = useParams();
  const { data, isLoading, reload } = useAsyncData(() => getPhase2ByToken(token), [token]);
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading || !data) return null;
  const { deadline, employees } = data;

  const toggleNr = (id) => {
    setForm((prev) => ({
      ...prev,
      nrIds: prev.nrIds.includes(id) ? prev.nrIds.filter((item) => item !== id) : [...prev.nrIds, id],
    }));
  };

  const handleAdd = async () => {
    setIsSaving(true);
    await addEmployee(token, form);
    setIsSaving(false);
    setForm(EMPTY_EMPLOYEE);
    setFiles([]);
    reload();
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>{deadline.laborRequestTitle}</p>
        <h1 className={authStyles.title}>Envio de colaboradores — Fase 2</h1>
        <p className={authStyles.subtitle}>
          Cadastre os colaboradores que atuarao nesta obra, com as NRs de cada um e os documentos comprobatorios.
        </p>

        <Phase2CountdownBanner deadline={deadline} />

        <div className={styles.formSection}>
          <div className={styles.grid}>
            <FormField label="Nome completo" required>
              <input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
            </FormField>
            <FormField label="CPF" required>
              <input value={form.cpf} onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))} placeholder="000.000.000-00" />
            </FormField>
            <FormField label="Funcao" required>
              <input value={form.roleFunction} onChange={(event) => setForm((prev) => ({ ...prev, roleFunction: event.target.value }))} />
            </FormField>
          </div>

          <span className={styles.groupLabel}>NRs deste colaborador</span>
          <div className={styles.chipRow}>
            {NR_TYPES.map((nr) => (
              <button
                type="button"
                key={nr.id}
                className={cn(styles.chip, form.nrIds.includes(nr.id) && styles.chipActive)}
                onClick={() => toggleNr(nr.id)}
              >
                {nr.code}
              </button>
            ))}
          </div>

          <div className={styles.dropzoneSpacer}>
            <FileDropzone files={files} onFilesChange={setFiles} hint="ASO e certificados de NR (PDF, JPG ou PNG)" />
          </div>

          <Button icon={LuUserPlus} onClick={handleAdd} isLoading={isSaving} disabled={!form.fullName || !form.cpf}>
            Adicionar colaborador
          </Button>
        </div>

        {employees.length > 0 && (
          <div className={styles.employeeList}>
            <h3 className={styles.sectionTitle}>Colaboradores enviados ({employees.length})</h3>
            {employees.map((employee) => (
              <div key={employee.id} className={styles.employeeRow}>
                <div>
                  <strong>{employee.fullName}</strong>
                  <div className={styles.employeeRole}>{employee.roleFunction}</div>
                </div>
                <NrBadgeList nrIds={employee.nrIds} />
                <StatusBadge enumMap={EMPLOYEE_STATUS} value={employee.status} />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
