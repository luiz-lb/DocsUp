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

const EMPTY_EMPLOYEE = { fullName: '', cpf: '', rg: '', roleFunction: '', nrTypeId: null };

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

  // Documentos da empresa: cada item = { file, documentTypeId }
  const [companyItems, setCompanyItems] = useState([]);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');

  // Colaboradores (uma NR + um arquivo por vez)
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [file, setFile] = useState(null);
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

  // Opções de tipo de documento da empresa (o técnico de segurança já definiu quais são exigidos)
  const companyDocTypeOptions = companyRequiredDocs.map((doc) => ({
    id: doc.document_type_id,
    name: doc.document_type_name,
  }));

  // NRs exigidas para a atividade (definidas por Segurança do Trabalho) → select pesquisável
  const nrOptions = (requiredNrTypes ?? []).map((nr) => ({
    id: nr.nr_type_id,
    code: nr.nr_code,
    name: nr.nr_name,
    description: nr.description,
  }));

  const companyDocuments = (documents ?? []).filter((doc) => !doc.employee_id);

  // ── Documentos da empresa ────────────────────────────────────────────────
  const handleCompanyFilesChange = (nextFiles) => {
    // mantém o tipo já escolhido para arquivos que continuam na lista
    setCompanyItems((prev) => {
      const byName = new Map(prev.map((item) => [item.file, item]));
      return nextFiles.map((f) => byName.get(f) ?? { file: f, documentTypeId: '' });
    });
  };

  const setCompanyItemType = (index, documentTypeId) => {
    setCompanyItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, documentTypeId } : item)),
    );
  };

  const companyFiles = companyItems.map((item) => item.file);
  const allCompanyTyped = companyItems.length > 0 && companyItems.every((item) => item.documentTypeId);

  const handleUploadCompany = async () => {
    setCompanyError('');
    setCompanySuccess('');

    if (!allCompanyTyped) {
      setCompanyError('Selecione o tipo de cada documento antes de enviar.');
      return;
    }

    setIsSavingCompany(true);
    const documentTypeIds = companyItems.map((item) => Number(item.documentTypeId));
    const result = await uploadCompanyDocuments(token, companyFiles, documentTypeIds);
    setIsSavingCompany(false);

    if (!result.success) {
      setCompanyError(result.body?.message ?? 'Erro ao enviar documentos da empresa.');
      return;
    }

    setCompanyItems([]);
    setCompanySuccess('Documentos da empresa enviados com sucesso.');
    reload();
  };

  // ── Colaboradores ─────────────────────────────────────────────────────────
  const handleAddEmployee = async () => {
    setSaveError('');

    if (!form.nrTypeId) {
      setSaveError('Selecione a NR deste certificado.');
      return;
    }
    if (!file) {
      setSaveError('Envie o certificado (um arquivo) desta NR.');
      return;
    }

    setIsSaving(true);
    const result = await addEmployee(token, form, file);
    setIsSaving(false);

    if (!result.success) {
      setSaveError(result.body?.message ?? 'Erro ao cadastrar colaborador.');
      return;
    }

    // Mantém os dados do colaborador para facilitar adicionar outra NR do mesmo,
    // mas limpa a NR e o arquivo (um por vez).
    setForm((prev) => ({ ...prev, nrTypeId: null }));
    setFile(null);
    reload();
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>{deadline.labor_request_title}</p>
        <h1 className={authStyles.title}>Envio de documentação — Fase 2</h1>
        <p className={authStyles.subtitle}>
          Envie os documentos da empresa e cadastre os colaboradores que atuarão nesta obra.
          Para cada colaborador, envie uma NR por vez com o certificado correspondente.
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
                    onFilesChange={handleCompanyFilesChange}
                    hint="Contrato social, CNDs, PGR, APR, etc. (PDF, JPG ou PNG)"
                  />
                </div>

                {/* Para cada arquivo, selecionar o tipo de documento */}
                {companyItems.length > 0 && (
                  <div className={styles.typedList}>
                    <p className={styles.groupLabel}>Classifique cada arquivo:</p>
                    {companyItems.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className={styles.typedRow}>
                        <span className={styles.typedFileName}>{item.file.name}</span>
                        <select
                          className={styles.typeSelect}
                          value={item.documentTypeId}
                          onChange={(e) => setCompanyItemType(index, e.target.value)}
                        >
                          <option value="">Selecione o tipo…</option>
                          {companyDocTypeOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {companyError && <Banner tone="danger" description={companyError} />}
                {companySuccess && <Banner tone="success" description={companySuccess} />}

                <Button
                  icon={LuUpload}
                  onClick={handleUploadCompany}
                  isLoading={isSavingCompany}
                  disabled={companyItems.length === 0}
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

            {/* Formulário de colaborador — uma NR + um certificado por vez */}
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

                {/* Select pesquisável — UMA NR por vez (vem do banco) */}
                <NrSearchSelect
                  label="NR deste certificado"
                  single
                  options={nrOptions}
                  value={form.nrTypeId}
                  onChange={(id) => setForm((prev) => ({ ...prev, nrTypeId: id }))}
                  placeholder="Pesquisar a NR deste certificado…"
                />

                {/* Um único arquivo — o certificado da NR selecionada */}
                <div className={styles.dropzoneSpacer}>
                  <FileDropzone
                    files={file ? [file] : []}
                    onFilesChange={(fs) => setFile(fs[fs.length - 1] ?? null)}
                    multiple={false}
                    label="Envie o certificado desta NR (um arquivo)"
                    hint="Certificado de NR / ASO (PDF, JPG ou PNG)"
                  />
                </div>

                {saveError && <Banner tone="danger" description={saveError} />}

                <Button
                  icon={LuUserPlus}
                  onClick={handleAddEmployee}
                  isLoading={isSaving}
                  disabled={!form.fullName || !form.cpf || !form.nrTypeId || !file}
                >
                  Adicionar NR do colaborador
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
