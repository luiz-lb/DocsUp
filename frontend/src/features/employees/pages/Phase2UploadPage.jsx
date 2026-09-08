import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuUserPlus, LuLogIn, LuBuilding2, LuUsers, LuUpload } from 'react-icons/lu';
import { Card, Button, FormField, FileDropzone, StatusBadge, Banner } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS, DOCUMENT_STATUS } from '../../../constants/enums.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getPhase2ByToken, addEmployee, uploadCompanyDocuments } from '../api/employeesApi.js';
import Phase2CountdownBanner from '../components/Phase2CountdownBanner/index.js';
import NrBadgeList from '../components/NrBadgeList/index.js';
import NrSearchSelect from '../components/NrSearchSelect/index.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './Phase2UploadPage.module.css';

const EMPTY_EMPLOYEE = { fullName: '', cpf: '', rg: '', roleFunction: '', nrTypeIds: [] };

const TABS = {
  COMPANY: 'company',
  EMPLOYEES: 'employees',
};

export default function Phase2UploadPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isSupplierAuth, isLoading: isAuthLoading } = useSupplierAuth();

  const { data, isLoading, reload } = useAsyncData(() => getPhase2ByToken(token), [token]);

  const [tab, setTab] = useState(TABS.COMPANY);

  // Documentos da empresa
  const [companyFiles, setCompanyFiles] = useState([]);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');

  // Colaboradores
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
          <p className={authStyles.eyebrow}>Fase 2 — Documentação</p>
          <h1 className={authStyles.title}>Faça login para continuar</h1>
          <p className={authStyles.subtitle}>
            Para enviar os documentos, você precisa estar autenticado no portal.
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

  const { deadline, employees, documents, requiredDocuments, requiredNrTypes } = data;

  const companyRequiredDocs = (requiredDocuments ?? []).filter((doc) => doc.scope === 0);
  const employeeRequiredDocs = (requiredDocuments ?? []).filter((doc) => doc.scope === 1);

  // NRs exigidas para a atividade (definidas por Segurança do Trabalho) → select pesquisável
  const nrOptions = (requiredNrTypes ?? []).map((nr) => ({
    id: nr.nr_type_id,
    code: nr.nr_code,
    name: nr.nr_name,
    description: nr.description,
  }));

  const companyDocuments = (documents ?? []).filter((doc) => !doc.employee_id);

  const handleUploadCompany = async () => {
    setCompanyError('');
    setCompanySuccess('');
    setIsSavingCompany(true);

    const result = await uploadCompanyDocuments(token, companyFiles);
    setIsSavingCompany(false);

    if (!result.success) {
      setCompanyError(result.body?.message ?? 'Erro ao enviar documentos da empresa.');
      return;
    }

    setCompanyFiles([]);
    setCompanySuccess('Documentos da empresa enviados com sucesso.');
    reload();
  };

  const handleAddEmployee = async () => {
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
        <h1 className={authStyles.title}>Envio de documentação — Fase 2</h1>
        <p className={authStyles.subtitle}>
          Envie os documentos da empresa e cadastre os colaboradores que atuarão nesta obra,
          com as NRs de cada um e os documentos comprobatórios (ASO, certificados de NR, etc.).
        </p>

        {/* Banner de countdown com expiração automática */}
        <Phase2CountdownBanner deadline={deadline} />

        {/* Abas: Documentos da empresa | Documentos dos colaboradores */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === TABS.COMPANY}
            className={cn(styles.tab, tab === TABS.COMPANY && styles.tabActive)}
            onClick={() => setTab(TABS.COMPANY)}
          >
            <LuBuilding2 /> Documentos da empresa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === TABS.EMPLOYEES}
            className={cn(styles.tab, tab === TABS.EMPLOYEES && styles.tabActive)}
            onClick={() => setTab(TABS.EMPLOYEES)}
          >
            <LuUsers /> Documentos dos colaboradores
          </button>
        </div>

        {/* ── Aba: Documentos da empresa ─────────────────────────────── */}
        {tab === TABS.COMPANY && (
          <div className={styles.tabPanel}>
            {companyRequiredDocs.length > 0 && (
              <div className={styles.requiredDocs}>
                <p className={styles.groupLabel}>Documentos da empresa exigidos:</p>
                <ul className={styles.docList}>
                  {companyRequiredDocs.map((doc) => (
                    <li key={doc.id} className={styles.docListItem}>
                      {doc.document_type_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!deadline.isExpired ? (
              <div className={styles.formSection}>
                <div className={styles.dropzoneSpacer}>
                  <FileDropzone
                    files={companyFiles}
                    onFilesChange={setCompanyFiles}
                    hint="Contrato social, CNDs, PGR, APR, etc. (PDF, JPG ou PNG)"
                  />
                </div>

                {companyError && <Banner tone="danger" description={companyError} />}
                {companySuccess && <Banner tone="success" description={companySuccess} />}

                <Button
                  icon={LuUpload}
                  onClick={handleUploadCompany}
                  isLoading={isSavingCompany}
                  disabled={companyFiles.length === 0}
                >
                  Enviar documentos da empresa
                </Button>
              </div>
            ) : (
              <Banner tone="danger" description="O prazo da Fase 2 encerrou. Não é possível enviar documentos." />
            )}

            {companyDocuments.length > 0 && (
              <div className={styles.employeeList}>
                <h3 className={styles.sectionTitle}>
                  Documentos da empresa enviados ({companyDocuments.length})
                </h3>
                {companyDocuments.map((doc) => (
                  <div key={doc.id} className={styles.employeeRow}>
                    <div>
                      <strong>{doc.document_type_name}</strong>
                      <div className={styles.employeeRole}>{doc.file_name}</div>
                    </div>
                    <StatusBadge enumMap={DOCUMENT_STATUS} value={doc.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Aba: Documentos dos colaboradores ──────────────────────── */}
        {tab === TABS.EMPLOYEES && (
          <div className={styles.tabPanel}>
            {employeeRequiredDocs.length > 0 && (
              <div className={styles.requiredDocs}>
                <p className={styles.groupLabel}>Documentos por colaborador exigidos:</p>
                <ul className={styles.docList}>
                  {employeeRequiredDocs.map((doc) => (
                    <li key={doc.id} className={styles.docListItem}>
                      {doc.document_type_name}
                      <span className={styles.perEmployeeTag}> (por colaborador)</span>
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

                {/* Select pesquisável das NRs exigidas para a atividade (vem do banco) */}
                <NrSearchSelect
                  options={nrOptions}
                  selectedIds={form.nrTypeIds}
                  onChange={(ids) => setForm((prev) => ({ ...prev, nrTypeIds: ids }))}
                />

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
                  onClick={handleAddEmployee}
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
                    <NrBadgeList nrs={employee.nrs ?? []} />
                    <StatusBadge enumMap={EMPLOYEE_STATUS} value={employee.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
