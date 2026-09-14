import { useEffect, useState } from 'react';
import { LuSave, LuBuilding2, LuMail, LuMapPin } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import SupplierLayout from '../components/SupplierLayout/index.js';
import SearchSelectList from '../components/SearchSelectList/index.js';
import { getSupplierProfile, updateSupplierProfile, searchRegions } from '../api/suppliersApi.js';
import { UFS } from '../../../constants/ufs.js';
import styles from './SupplierMyProfilePage.module.css';

// Tipos de contato (espelha CONTACT_TYPE do schema)
const CONTACT_TYPES = [
  { type: 0, label: 'Responsável legal', required: true },
  { type: 1, label: 'Responsável operacional', required: true },
  { type: 2, label: 'Responsável financeiro', required: false },
];

const EMPTY_CONTACT = { name: '', email: '', phone: '' };

export default function SupplierMyProfilePage() {
  const [company, setCompany] = useState({
    razaoSocial: '', cnpj: '', nomeFantasia: '', employeeCount: '',
    address: '', city: '', state: '', zipCode: '', phone: '', website: '',
  });
  // contatos por tipo: { 0: {...}, 1: {...}, 2: {...} }
  const [contacts, setContacts] = useState({ 0: { ...EMPTY_CONTACT }, 1: { ...EMPTY_CONTACT }, 2: { ...EMPTY_CONTACT } });
  const [regions, setRegions] = useState([]); // [{ id, label, sublabel }]

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    getSupplierProfile().then((data) => {
      if (!active || !data) { setIsLoading(false); return; }

      const s = data.supplier;
      setCompany({
        razaoSocial: s.razao_social ?? '',
        cnpj: s.cnpj ?? '',
        nomeFantasia: s.nome_fantasia ?? '',
        employeeCount: s.employee_count ?? '',
        address: s.address ?? '',
        city: s.city ?? '',
        state: s.state ?? '',
        zipCode: s.zip_code ?? '',
        phone: s.phone ?? '',
        website: s.website ?? '',
      });

      const nextContacts = { 0: { ...EMPTY_CONTACT }, 1: { ...EMPTY_CONTACT }, 2: { ...EMPTY_CONTACT } };
      for (const c of data.contacts ?? []) {
        nextContacts[c.contact_type] = { name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '' };
      }
      setContacts(nextContacts);

      setRegions((data.regions ?? []).map((r) => ({
        id: r.id,
        label: r.city ?? r.state,
        sublabel: r.state,
      })));

      setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const setContactField = (type, field) => (e) =>
    setContacts((prev) => ({ ...prev, [type]: { ...prev[type], [field]: e.target.value } }));

  const setCompanyField = (field) => (e) =>
    setCompany((prev) => ({ ...prev, [field]: e.target.value }));

  const fetchRegions = async (query) => {
    const results = await searchRegions({ city: query });
    return results.map((r) => ({ id: r.id, label: r.city, sublabel: r.state }));
  };

  const addRegion = (item) => setRegions((prev) => [...prev, item]);
  const removeRegion = (id) => setRegions((prev) => prev.filter((r) => r.id !== id));

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!contacts[0].email || !contacts[1].email) {
      setError('Os e-mails do responsável legal e operacional são obrigatórios.');
      return;
    }

    setIsSaving(true);
    const payload = {
      nomeFantasia: company.nomeFantasia,
      employeeCount: company.employeeCount ? Number(company.employeeCount) : null,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      phone: company.phone,
      website: company.website,
      contacts: CONTACT_TYPES.map(({ type }) => ({
        contactType: type,
        name: contacts[type].name,
        email: contacts[type].email,
        phone: contacts[type].phone,
      })),
      regionIds: regions.map((r) => r.id),
    };

    const result = await updateSupplierProfile(payload);
    setIsSaving(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao salvar o perfil.');
      return;
    }
    setSuccess('Perfil atualizado com sucesso.');
  };

  return (
    <SupplierLayout>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Portal do Fornecedor</p>
          <h1 className={styles.pageTitle}>Perfil da empresa</h1>
        </div>
        <Button icon={LuSave} isLoading={isSaving} onClick={handleSave} disabled={isLoading}>
          Salvar alterações
        </Button>
      </div>
      
        {error && <Banner tone="danger" className={styles.aviso} description={error} />}
        {success && <Banner tone="success" className={styles.aviso} description={success} />}

      {isLoading ? (
        <p className={styles.loading}>Carregando perfil…</p>
      ) : (
        <div className={styles.grid}>
          {/* Dados da empresa */}
          <Card>
            <Card.Body>
              <h3 className={styles.sectionTitle}><LuBuilding2 /> Dados da empresa</h3>

              <div className={styles.fieldGrid}>
                <FormField label="Razão social">
                  <input value={company.razaoSocial} disabled readOnly />
                </FormField>
                <FormField label="CNPJ">
                  <input value={company.cnpj} disabled readOnly />
                </FormField>
                <FormField label="Nome fantasia">
                  <input value={company.nomeFantasia} onChange={setCompanyField('nomeFantasia')} />
                </FormField>
                <FormField label="Quantidade de colaboradores">
                  <input
                    type="number"
                    min="0"
                    value={company.employeeCount}
                    onChange={setCompanyField('employeeCount')}
                  />
                </FormField>
                <FormField label="Telefone">
                  <input value={company.phone} onChange={setCompanyField('phone')} placeholder="(00) 00000-0000" />
                </FormField>
                <FormField label="Website">
                  <input value={company.website} onChange={setCompanyField('website')} placeholder="https://" />
                </FormField>
              </div>

              <h4 className={styles.subTitle}>Endereço</h4>
              <div className={styles.fieldGrid}>
                <FormField label="Logradouro" className={styles.spanTwo}>
                  <input value={company.address} onChange={setCompanyField('address')} />
                </FormField>
                <FormField label="Cidade">
                  <input value={company.city} onChange={setCompanyField('city')} />
                </FormField>
                <FormField label="UF">
                  <select value={company.state} onChange={setCompanyField('state')}>
                    <option value="">—</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </FormField>
                <FormField label="CEP">
                  <input value={company.zipCode} onChange={setCompanyField('zipCode')} placeholder="00000-000" />
                </FormField>
              </div>
            </Card.Body>
          </Card>

          {/* Contatos */}
          <Card>
            <Card.Body>
              <h3 className={styles.sectionTitle}><LuMail /> Contatos</h3>
              {CONTACT_TYPES.map(({ type, label, required }) => (
                <div key={type} className={styles.contactBlock}>
                  <p className={styles.contactLabel}>
                    {label}{required && <span className={styles.required}> *</span>}
                  </p>
                  <div className={styles.fieldGrid}>
                    <FormField label="Nome">
                      <input value={contacts[type].name} onChange={setContactField(type, 'name')} />
                    </FormField>
                    <FormField label="E-mail" required={required}>
                      <input
                        type="email"
                        value={contacts[type].email}
                        onChange={setContactField(type, 'email')}
                        placeholder="email@empresa.com.br"
                      />
                    </FormField>
                    <FormField label="Telefone">
                      <input value={contacts[type].phone} onChange={setContactField(type, 'phone')} />
                    </FormField>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>

          {/* Regiões atendidas */}
          <Card>
            <Card.Body>
              <h3 className={styles.sectionTitle}><LuMapPin /> Regiões atendidas</h3>
              <SearchSelectList
                label="Cidades atendidas"
                placeholder="Pesquisar cidade…"
                selected={regions}
                onAdd={addRegion}
                onRemove={removeRegion}
                fetchOptions={fetchRegions}
                minChars={2}
                emptyHint="Nenhuma cidade adicionada ainda."
              />
            </Card.Body>
          </Card>
        </div>
      )}
    </SupplierLayout>
  );
}
