import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { LuLogIn, LuUserPlus } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import CnpjField from '../components/CnpjField.jsx';
import styles from '../../../styles/authCard.module.css';

// Login por CNPJ ou por e-mail operacional
const IDENTIFIER = { CNPJ: 'cnpj', EMAIL: 'email' };

export default function SupplierLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Token de proposta (cotação) vindo na URL: ?tokenProposta=XXX
  const tokenProposta = searchParams.get('tokenProposta');
  // Token da Fase 2 vindo na URL: ?fase2=XXX
  const fase2Token = searchParams.get('fase2');
  // Rota de origem quando o guard redirecionou para o login
  const returnTo = location.state?.returnTo ?? null;

  const { loginPhase1 } = useSupplierAuth();

  const [mode, setMode] = useState(IDENTIFIER.CNPJ);
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    // Identifica por CNPJ ou por e-mail operacional
    const identifier = mode === IDENTIFIER.CNPJ ? cnpj : email;
    const result = await loginPhase1(identifier, password, mode);
    setIsLoading(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Não foi possível autenticar. Verifique os dados e a senha.');
      return;
    }

    if (result.body?.requiresMfa) {
      // Propaga o devOtp (dev) e os tokens (proposta / fase 2) para a tela de MFA
      navigate(ROUTES.suppliers.mfa, {
        state: {
          devOtp: result.body?.devOtp ?? null,
          tokenProposta: tokenProposta ?? null,
          fase2Token: fase2Token ?? null,
          returnTo: returnTo ?? null,
        },
      });
    }
  };

  const buildRegisterUrl = () => {
    if (tokenProposta) return `${ROUTES.suppliers.register}?tokenProposta=${tokenProposta}`;
    if (fase2Token) return `${ROUTES.suppliers.register}?fase2=${fase2Token}`;
    return ROUTES.suppliers.register;
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Acesse com o CNPJ ou e-mail operacional e a senha cadastrados.</p>

        {/* Alternância entre CNPJ e e-mail operacional */}
        <div className={styles.segmented} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === IDENTIFIER.CNPJ}
            className={mode === IDENTIFIER.CNPJ ? styles.segmentActive : styles.segment}
            onClick={() => { setMode(IDENTIFIER.CNPJ); setError(''); }}
          >
            CNPJ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === IDENTIFIER.EMAIL}
            className={mode === IDENTIFIER.EMAIL ? styles.segmentActive : styles.segment}
            onClick={() => { setMode(IDENTIFIER.EMAIL); setError(''); }}
          >
            E-mail operacional
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === IDENTIFIER.CNPJ ? (
            <CnpjField value={cnpj} onChange={setCnpj} />
          ) : (
            <FormField label="E-mail operacional" required>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operacional@empresa.com.br"
                autoComplete="email"
              />
            </FormField>
          )}

          <FormField label="Senha" required>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </FormField>

          {error && <Banner tone="danger" description={error} />}

          <Button type="submit" icon={LuLogIn} isLoading={isLoading} fullWidth>
            Entrar
          </Button>
        </form>

        <button
          type="button"
          className={styles.registerLink}
          onClick={() => navigate(buildRegisterUrl())}
        >
          <LuUserPlus /> Ainda não tenho cadastro
        </button>
      </Card.Body>
    </Card>
  );
}
