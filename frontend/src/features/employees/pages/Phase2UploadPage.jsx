import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuUserPlus, LuLogIn } from 'react-icons/lu';
import { Card, Button, FormField, FileDropzone, StatusBadge, Banner } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../constants/enums.js';
import { NR_TYPES } from '../../../mocks/catalog.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getPhase2ByToken, addEmployee } from '../api/employeesApi.js';
import Phase2CountdownBanner from '../components/Phase2CountdownBanner/index.js';
import NrBadgeList from '../components/NrBadgeList/index.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './Phase2UploadPage.module.css';

const EMPTY_EMPLOYEE = { fullName: '', cpf: '', rg: '', roleFunction: '', nrTypeIds: [] };

export default function Phase2UploadPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isSupplierAuth, isLoading: isAuthLoading } = useSupplierAuth();

  const { data, isLoading, reload } = useAsyncData(() => getPhase2ByToken(token), [token]);
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [files, setFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Aguarda validação de autenticação
  if (isAuthLoading || isLoading) return null;

  // Fornecedor não autenticado
  if (!isSupplierAuth) {
    return (
      <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
        <Card.Body>
          <p className={authStyles.eyebrow}>Fase 2 — Documentação de Colaboradores</p>
          <h1 className={authStyles.title}>Faça login para continuar</h1>
          <p className={authStyles.subtitle}>
            Para enviar os colaboradores, você precisa estar autenticado no portal.
          </p>
          <Button
            icon={LuLogIn}
            fullWidth
            onClick={() =>
              navigate(ROUTES.suppliers.login, {
                state: { returnTo: `/fase2/${token}` },
              })
            }
          >
            Entrar no portal
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
        <Card.Body>
          <h1 className={authStyles.title}>Link inválido</h1>
          <p className={authStyles.subtitle}>
            O link da Fase 2 é inválido, expirado ou já foi utilizado.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const { deadline, employees, documents, requiredDocuments } = data;

  const toggleNr = (id) => {
    setForm((prev) => ({
      ...prev,
      nrTypeIds: prev.nrTypeIds.includes(id)
        ? prev.nrTypeIds.filter((item) => item !== id)
        : [...prev.nrTypeIds, id],
    }));
  };

  const handleAdd = async () => {
    setSaveError('');
    setIsSaving(true);

    const result = await addEmployee(token, form, files);
    setIsSaving(false);

    if (!result.success) {
      setSaveError(result.body?.message ?? 'Erro ao cadastrar colaborador.');
      return;
    }

    setForm(EMPTY_EMPLOYEE);
    setFiles([]);
    reload();
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>{deadline.labor_request_title}</p>
        <h1 className={authStyles.title}>Envio de colaboradores — Fase 2</h1>
        <p className={authStyles.subtitle}>
          Cadastre os colaboradores que atuarão nesta obra, com as NRs de cada um e os documentos
          comprobatórios (ASO, certificados de NR, etc.).
        </p>

        {/* Banner de countdown com expiração automática */}
        <Phase2CountdownBanner deadline={deadline} />

        {/* Documentos obrigatórios definidos por Segurança do Trabalho */}
        {requiredDocuments && requiredDocuments.length > 0 && (
          <div className={styles.requiredDocs}>
            <p className={styles.groupLabel}>Documentos exigidos para esta contratação:</p>
            <ul className={styles.docList}>
              {requiredDocuments.map((doc) => (
                <li key={doc.id} className={styles.docListItem}>
                  {doc.document_type_name}
                  {doc.scope === 1 && <span className={styles.perEmployeeTag}> (por colaborador)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulário de novo colaborador */}
        {!deadline.isExpired && (
          <div className={styles.formSection}>
            <div className={styles.grid}>
              <FormField label="Nome completo" required>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </FormField>
              <FormField label="CPF" required>
                <input
                  value={form.cpf}
                  onChange={(e) => setForm((prev) => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </FormField>
              <FormField label="Função">
                <input
                  value={form.roleFunction}
                  onChange={(e) => setForm((prev) => ({ ...prev, roleFunction: e.target.value }))}
                  placeholder="Ex.: Eletricista"
                />
              </FormField>
            </div>

            <span className={styles.groupLabel}>NRs deste colaborador</span>
            <div className={styles.chipRow}>
              {NR_TYPES.map((nr) => (
                <button
                  type="button"
                  key={nr.id}
                  className={cn(styles.chip, form.nrTypeIds.includes(nr.id) && styles.chipActive)}
                  onClick={() => toggleNr(nr.id)}
                >
                  {nr.code}
                </button>
              ))}
            </div>

            <div className={styles.dropzoneSpacer}>
              <FileDropzone
                files={files}
                onFilesChange={setFiles}
                hint="ASO e certificados de NR (PDF, JPG ou PNG)"
              />
            </div>

            {saveError && <Banner tone="danger" description={saveError} />}

            <Button
              icon={LuUserPlus}
              onClick={handleAdd}
              isLoading={isSaving}
              disabled={!form.fullName || !form.cpf}
            >
              Adicionar colaborador
            </Button>
          </div>
        )}

        {/* Lista de colaboradores já enviados */}
        {employees.length > 0 && (
          <div className={styles.employeeList}>
            <h3 className={styles.sectionTitle}>
              Colaboradores enviados ({employees.length})
            </h3>
            {employees.map((employee) => (
              <div key={employee.id} className={styles.employeeRow}>
                <div>
                  <strong>{employee.full_name}</strong>
                  <div className={styles.employeeRole}>{employee.role_function}</div>
                </div>
                <NrBadgeList nrIds={(employee.nrs ?? []).map((n) => n.nr_type_id)} />
                <StatusBadge enumMap={EMPLOYEE_STATUS} value={employee.status} />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
