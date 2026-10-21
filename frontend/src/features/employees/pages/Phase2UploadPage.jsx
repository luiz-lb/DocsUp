import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuLogIn, LuBuilding2, LuUsers, LuUpload } from 'react-icons/lu';
import { Card, Button, FormField, FileDropzone, StatusBadge, Banner, SearchSelect } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS, DOCUMENT_CATEGORY, DOCUMENT_CATEGORY_ID } from '../../../constants/enums.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getPhase2ByToken, addEmployee, uploadCompanyDocuments, downloadPhase2Document } from '../api/employeesApi.js';
import Phase2CountdownBanner from '../components/Phase2CountdownBanner/index.js';
import SupplierDocumentItem from '../components/SupplierDocumentItem/index.js';
import ResendDocumentModal from '../components/ResendDocumentModal/index.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import { addDaysToToday, toDateInputValue } from '../../../utils/formatters.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './Phase2UploadPage.module.css';

const EMPTY_EMPLOYEE = { fullName: '', cpf: '', rg: '', roleFunction: '', documentTypeId: '', expiresAt: '' };

const TABS = {
  COMPANY: 'company',
  EMPLOYEES: 'employees',
};

// Status em que o RH devolveu o documento (dá para reenviar mesmo depois do prazo)
const RESENDABLE_STATUSES = [3, 4];

// Categorias dos documentos do colaborador, na ordem de exibição (básicos primeiro)
const EMPLOYEE_CATEGORIES = [DOCUMENT_CATEGORY_ID.BASICO, DOCUMENT_CATEGORY_ID.NR, DOCUMENT_CATEGORY_ID.OUTRO];

/** Validade sugerida pelo prazo padrão do tipo (hoje + validity_days), ou vazio. */
function suggestedExpiry(documentType) {
  return documentType?.has_expiration && documentType.validity_days ? addDaysToToday(documentType.validity_days) : '';
}

/** Tipos agrupados por categoria (básicos, NRs, outros), com os exigidos primeiro em cada grupo. */
function groupByCategory(documentTypes) {
  return EMPLOYEE_CATEGORIES.map((category) => ({
    category,
    label: DOCUMENT_CATEGORY[category].label,
    items: documentTypes
      .filter((type) => type.category === category)
      .sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required))),
  })).filter((group) => group.items.length > 0);
}

/** Nota sob a data sugerida: o prazo padrão é só um ponto de partida. */
function ExpiryNote({ documentType }) {
  if (!documentType?.validity_days) return null;
  return (
    <p className={styles.fieldNote}>
      Sugerida pelo prazo padrão de {documentType.validity_days} {Number(documentType.validity_days) === 1 ? 'dia' : 'dias'}.
      Confira a data no documento.
    </p>
  );
}

export default function Phase2UploadPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isSupplierAuth, isLoading: isAuthLoading } = useSupplierAuth();

  const { data: response, isLoading, reload } = useAsyncData(() => getPhase2ByToken(token), [token]);

  const [tab, setTab] = useState(TABS.COMPANY);

  // Documentos da empresa: cada item = { file, documentTypeId, expiresAt }
  const [companyItems, setCompanyItems] = useState([]);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState('');

  // Colaboradores (um documento + um arquivo por vez)
  const [form, setForm] = useState(EMPTY_EMPLOYEE);
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Documentos enviados: download, reenvio (modal) e o aviso de cada ação
  const [downloadingId, setDownloadingId] = useState(null);
  const [resendTarget, setResendTarget] = useState(null);
  const [docFeedback, setDocFeedback] = useState(null);

  // Aguarda validação de autenticação (nos recarregamentos, mantém a tela com os dados atuais)
  if (isAuthLoading || (isLoading && !response)) return null;

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
              // Passa o token da Fase 2 na URL para que login → MFA
              // consigam redirecionar de volta para /fase2/:token após autenticar.
              navigate(`${ROUTES.suppliers.login}?fase2=${token}`)
            }
          >
            Entrar no portal
          </Button>
        </Card.Body>
      </Card>
    );
  }

  // Link inválido, expirado ou de outro fornecedor: mostra a mensagem do backend
  if (!response?.success) {
    return (
      <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
        <Card.Body>
          <p className={authStyles.eyebrow}>Fase 2 — Documentação</p>
          <h1 className={authStyles.title}>Não foi possível abrir este link</h1>
          <p className={authStyles.subtitle}>
            {response?.message ?? 'O link da Fase 2 é inválido, expirado ou já foi utilizado.'}
          </p>
        </Card.Body>
      </Card>
    );
  }

  const phase2 = response.body;
  const { deadline } = phase2;
  const employees = phase2.employees ?? [];
  const employeeDocumentTypes = phase2.employeeDocumentTypes ?? [];
  const companyDocumentTypes = phase2.companyDocumentTypes ?? [];
  const today = toDateInputValue();

  const companyRequiredDocs = (phase2.requiredDocuments ?? []).filter((doc) => doc.scope === 0);
  const companyDocuments = (phase2.documents ?? []).filter((doc) => !doc.employee_id);

  // Reenvio: antes do prazo, qualquer documento (troca o arquivo); depois, só o que o RH
  // devolveu (reprovado ou reenvio necessário). O tipo precisa continuar disponível.
  const canResend = (doc, documentType) =>
    Boolean(documentType) && (!deadline.isExpired || RESENDABLE_STATUSES.includes(doc.status));

  const returnedCount = [...companyDocuments, ...employees.flatMap((employee) => employee.documents ?? [])]
    .filter((doc) => RESENDABLE_STATUSES.includes(doc.status)).length;

  const handleDownload = async (delivery) => {
    setDownloadingId(delivery.id);
    setDocFeedback(null);
    const result = await downloadPhase2Document(token, delivery.id);
    setDownloadingId(null);
    if (!result.success) {
      setDocFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao baixar o arquivo.' });
    }
  };

  const handleResendSuccess = (message) => {
    setResendTarget(null);
    setDocFeedback({ tone: 'success', message });
    reload();
  };

  // Tipos por id (o <select> trabalha com string)
  const companyTypeById = new Map(companyDocumentTypes.map((type) => [String(type.id), type]));
  const employeeTypeById = new Map(employeeDocumentTypes.map((type) => [String(type.id), type]));

  // Select do colaborador (todos os tipos) e lista dos exigidos, agrupados por categoria
  const employeeTypeOptions = groupByCategory(employeeDocumentTypes).flatMap((group) =>
    group.items.map((type) => ({
      value: String(type.id),
      label: type.name,
      group: group.label,
      hint: type.required ? 'exigido' : null,
      searchText: type.description ?? '',
    })),
  );
  const requiredEmployeeGroups = groupByCategory(employeeDocumentTypes.filter((type) => type.required));

  // ── Documentos da empresa ────────────────────────────────────────────────
  const companyItemNeedsExpiry = (item) => Boolean(companyTypeById.get(String(item.documentTypeId))?.has_expiration);

  const handleCompanyFilesChange = (nextFiles) => {
    // mantém o tipo e a validade já escolhidos para arquivos que continuam na lista
    setCompanyItems((prev) => {
      const byFile = new Map(prev.map((item) => [item.file, item]));
      return nextFiles.map((f) => byFile.get(f) ?? { file: f, documentTypeId: '', expiresAt: '' });
    });
  };

  const setCompanyItemType = (index, documentTypeId) => {
    setCompanyItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, documentTypeId, expiresAt: suggestedExpiry(companyTypeById.get(documentTypeId)) }
          : item,
      ),
    );
  };

  const setCompanyItemExpiry = (index, expiresAt) => {
    setCompanyItems((prev) => prev.map((item, i) => (i === index ? { ...item, expiresAt } : item)));
  };

  const companyFiles = companyItems.map((item) => item.file);
  const allCompanyTyped = companyItems.length > 0 && companyItems.every((item) => item.documentTypeId);
  const anyCompanySuggestion = companyItems.some(
    (item) => companyItemNeedsExpiry(item) && companyTypeById.get(String(item.documentTypeId))?.validity_days,
  );

  const validateCompany = () => {
    if (!allCompanyTyped) return 'Selecione o tipo de cada documento antes de enviar.';
    // Uma entrega por documento: o mesmo tipo em dois arquivos não pode
    const typeIds = companyItems.map((item) => String(item.documentTypeId));
    const repeated = typeIds.find((typeId, index) => typeIds.indexOf(typeId) !== index);
    if (repeated) {
      return `Envie um arquivo para cada documento: "${companyTypeById.get(repeated)?.name ?? 'documento'}" foi escolhido mais de uma vez.`;
    }
    for (const item of companyItems) {
      if (!companyItemNeedsExpiry(item)) continue;
      if (!item.expiresAt) return `Informe a validade de "${item.file.name}".`;
      if (item.expiresAt < today) return `A validade de "${item.file.name}" não pode ser anterior a hoje.`;
    }
    return null;
  };

  const handleUploadCompany = async () => {
    setCompanyError('');
    setCompanySuccess('');

    const validationError = validateCompany();
    if (validationError) {
      setCompanyError(validationError);
      return;
    }

    setIsSavingCompany(true);
    const documentTypeIds = companyItems.map((item) => Number(item.documentTypeId));
    const expiresAt = companyItems.map((item) => (companyItemNeedsExpiry(item) ? item.expiresAt : null));
    const result = await uploadCompanyDocuments(token, companyFiles, documentTypeIds, expiresAt);
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
  const selectedEmployeeType = employeeTypeById.get(String(form.documentTypeId));
  const employeeNeedsExpiry = Boolean(selectedEmployeeType?.has_expiration);

  const setEmployeeDocumentType = (documentTypeId) => {
    setForm((prev) => ({
      ...prev,
      documentTypeId,
      expiresAt: suggestedExpiry(employeeTypeById.get(documentTypeId)),
    }));
  };

  const validateEmployee = () => {
    if (!form.fullName.trim() || !form.cpf.trim()) return 'Informe o nome completo e o CPF do colaborador.';
    if (!form.documentTypeId) return 'Selecione qual documento é este arquivo.';
    if (employeeNeedsExpiry && !form.expiresAt) return 'Informe a validade do documento.';
    if (employeeNeedsExpiry && form.expiresAt < today) return 'A validade do documento não pode ser anterior a hoje.';
    if (!file) return 'Envie o arquivo deste documento.';
    return null;
  };

  const handleAddEmployee = async () => {
    setSaveError('');
    setSaveSuccess('');

    const validationError = validateEmployee();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);
    const result = await addEmployee(
      token,
      {
        fullName: form.fullName,
        cpf: form.cpf,
        rg: form.rg,
        roleFunction: form.roleFunction,
        documentTypeId: Number(form.documentTypeId),
        expiresAt: employeeNeedsExpiry ? form.expiresAt : null,
      },
      file,
    );
    setIsSaving(false);

    if (!result.success) {
      setSaveError(result.body?.message ?? 'Erro ao enviar o documento do colaborador.');
      return;
    }

    // Mantém os dados do colaborador para facilitar enviar outro documento dele,
    // mas limpa o documento, a validade e o arquivo (um por vez).
    setSaveSuccess(`Documento enviado: ${selectedEmployeeType?.name ?? 'documento'} de ${form.fullName}.`);
    setForm((prev) => ({ ...prev, documentTypeId: '', expiresAt: '' }));
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
          Para cada colaborador, envie um documento por vez (ASO, certificados de NR, Ficha de EPI…).
        </p>

        {/* Banner de countdown com expiração automática */}
        <Phase2CountdownBanner deadline={deadline} />

        {deadline.isExpired && (
          <Banner
            tone="info"
            description="O prazo de envio encerrou. Você ainda pode reenviar os documentos reprovados ou com reenvio necessário (botão Reenviar em cada um)."
          />
        )}
        {returnedCount > 0 && (
          <Banner
            tone="warning"
            title={`${returnedCount} documento${returnedCount === 1 ? '' : 's'} para reenviar`}
            description="O RH reprovou ou pediu o reenvio. Veja o motivo em cada documento e use o botão Reenviar."
          />
        )}
        {docFeedback && <Banner tone={docFeedback.tone} description={docFeedback.message} />}

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

            {!deadline.isExpired && (
              <div className={styles.formSection}>
                <div className={styles.dropzoneSpacer}>
                  <FileDropzone
                    files={companyFiles}
                    onFilesChange={handleCompanyFilesChange}
                    hint="Contrato social, CNDs, PGR, APR, etc. (PDF, JPG ou PNG)"
                  />
                </div>

                {/* Para cada arquivo: o tipo de documento e, se o tipo tem validade, a data */}
                {companyItems.length > 0 && (
                  <div className={styles.typedList}>
                    <p className={styles.groupLabel}>Classifique cada arquivo:</p>
                    {companyItems.map((item, index) => {
                      const needsExpiry = companyItemNeedsExpiry(item);
                      return (
                        <div
                          key={`${item.file.name}-${index}`}
                          className={cn(styles.typedRow, needsExpiry && styles.typedRowWithDate)}
                        >
                          <FormField label={item.file.name} className={styles.fileLabel}>
                            <select
                              value={item.documentTypeId}
                              onChange={(e) => setCompanyItemType(index, e.target.value)}
                            >
                              <option value="">Selecione o tipo…</option>
                              {companyDocumentTypes.map((type) => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                              ))}
                            </select>
                          </FormField>
                          {needsExpiry && (
                            <FormField label="Validade" required>
                              <input
                                type="date"
                                value={item.expiresAt}
                                min={today}
                                onChange={(e) => setCompanyItemExpiry(index, e.target.value)}
                              />
                            </FormField>
                          )}
                        </div>
                      );
                    })}
                    {anyCompanySuggestion && (
                      <p className={styles.fieldNote}>
                        Algumas validades foram sugeridas pelo prazo padrão do tipo. Confira a data em cada documento.
                      </p>
                    )}
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
            )}

            {companyDocuments.length > 0 && (
              <div className={styles.employeeList}>
                <h3 className={styles.sectionTitle}>
                  Documentos da empresa enviados ({companyDocuments.length})
                </h3>
                {companyDocuments.map((doc) => {
                  const documentType = companyTypeById.get(String(doc.document_type_id));
                  return (
                    <SupplierDocumentItem
                      key={doc.id}
                      document={doc}
                      canResend={canResend(doc, documentType)}
                      onResend={() => setResendTarget({ document: doc, documentType, employee: null })}
                      onDownload={handleDownload}
                      downloadingId={downloadingId}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Aba: Documentos dos colaboradores ──────────────────────── */}
        {tab === TABS.EMPLOYEES && (
          <div className={styles.tabPanel}>
            {requiredEmployeeGroups.length > 0 && (
              <div className={styles.requiredDocs}>
                <p className={styles.groupLabel}>Documentos por colaborador exigidos:</p>
                {requiredEmployeeGroups.map((group) => (
                  <div key={group.category} className={styles.requiredGroup}>
                    <p className={styles.requiredGroupTitle}>{group.label}</p>
                    <ul className={styles.docList}>
                      {group.items.map((type) => (
                        <li key={type.id} className={styles.docListItem}>
                          {type.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário de colaborador — um documento + um arquivo por vez */}
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

                {/* Qual documento é o arquivo (básicos, NRs e outros) e, se tiver validade, a data */}
                <div className={cn(styles.typedRow, employeeNeedsExpiry && styles.typedRowWithDate)}>
                  <FormField label="Qual documento é este arquivo?" required>
                    <SearchSelect
                      options={employeeTypeOptions}
                      value={form.documentTypeId}
                      onChange={setEmployeeDocumentType}
                      placeholder="Selecione ou pesquise o documento…"
                      emptyMessage="Nenhum documento encontrado."
                    />
                  </FormField>
                  {employeeNeedsExpiry && (
                    <FormField label="Validade do documento" required>
                      <input
                        type="date"
                        value={form.expiresAt}
                        min={today}
                        onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </FormField>
                  )}
                </div>
                {employeeNeedsExpiry && <ExpiryNote documentType={selectedEmployeeType} />}

                {/* Um único arquivo — o documento selecionado */}
                <div className={styles.dropzoneSpacer}>
                  <FileDropzone
                    files={file ? [file] : []}
                    onFilesChange={(fs) => setFile(fs[fs.length - 1] ?? null)}
                    multiple={false}
                    label="Envie o arquivo deste documento (um arquivo)"
                    hint="ASO, certificado de NR, Ficha de EPI… (PDF, JPG ou PNG)"
                  />
                </div>

                {saveError && <Banner tone="danger" description={saveError} />}
                {saveSuccess && <Banner tone="success" description={saveSuccess} />}

                <Button
                  icon={LuUpload}
                  onClick={handleAddEmployee}
                  isLoading={isSaving}
                  disabled={
                    !form.fullName ||
                    !form.cpf ||
                    !form.documentTypeId ||
                    (employeeNeedsExpiry && !form.expiresAt) ||
                    !file
                  }
                >
                  Enviar documento do colaborador
                </Button>
              </div>
            )}

            {/* Lista de colaboradores já enviados, com os documentos de cada um */}
            {employees.length > 0 && (
              <div className={styles.employeeList}>
                <h3 className={styles.sectionTitle}>
                  Colaboradores enviados ({employees.length})
                </h3>
                {employees.map((employee) => {
                  const employeeDocuments = employee.documents ?? [];
                  return (
                    <div key={employee.id} className={styles.employeeCard}>
                      <div className={styles.employeeHeader}>
                        <div>
                          <strong>{employee.full_name}</strong>
                          {employee.role_function && <div className={styles.employeeRole}>{employee.role_function}</div>}
                        </div>
                        <StatusBadge enumMap={EMPLOYEE_STATUS} value={employee.status} />
                      </div>

                      {employeeDocuments.length > 0 ? (
                        <div className={styles.employeeDocs}>
                          {employeeDocuments.map((doc) => {
                            const documentType = employeeTypeById.get(String(doc.document_type_id));
                            return (
                              <SupplierDocumentItem
                                key={doc.id}
                                document={doc}
                                canResend={canResend(doc, documentType)}
                                onResend={() => setResendTarget({ document: doc, documentType, employee })}
                                onDownload={handleDownload}
                                downloadingId={downloadingId}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.employeeDocsEmpty}>Nenhum documento enviado.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card.Body>

      <ResendDocumentModal
        open={Boolean(resendTarget)}
        token={token}
        target={resendTarget}
        onClose={() => setResendTarget(null)}
        onSuccess={handleResendSuccess}
      />
    </Card>
  );
}
