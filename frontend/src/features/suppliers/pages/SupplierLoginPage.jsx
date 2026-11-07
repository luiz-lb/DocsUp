import { useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { LuLogIn, LuUserPlus } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import styles from '../../../styles/authCard.module.css';

/**
 * Login do fornecedor: e-mail do usuário (Responsável ou Operador) e senha. Depois vem o
 * código de 6 dígitos enviado para o e-mail (tela de código).
 *
 * Os tokens da URL (?fase2 / ?tokenProposta) vêm dos links abertos sem sessão: seguem para o
 * cadastro e, depois do login, a tela de código volta para o link.
 */
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
  // Vindo do cadastro: e-mail do Responsável já preenchido e aviso de cadastro concluído
  const registeredEmail = location.state?.registeredEmail ?? '';

  const { loginPhase1 } = useSupplierAuth();

  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginPhase1(email.trim(), password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Não foi possível entrar. Confira o e-mail e a senha.');
      return;
    }

    if (result.body?.requiresMfa) {
      // Leva o devOtp (só fora de produção) e os tokens (proposta / fase 2) para a tela de código
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
    if (tokenProposta) return `${ROUTES.suppliers.register}?tokenProposta=${encodeURIComponent(tokenProposta)}`;
    if (fase2Token) return `${ROUTES.suppliers.register}?fase2=${encodeURIComponent(fase2Token)}`;
    return ROUTES.suppliers.register;
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Use o seu e-mail (Responsável ou Operador) e a sua senha.</p>

        {fase2Token && !registeredEmail && (
          <Banner
            tone="info"
            title="Você recebeu um convite de contrato"
            description="Entre com o seu e-mail. Se a sua empresa ainda não tem cadastro, use “Ainda não tenho cadastro” e depois volte por aqui."
          />
        )}

        {registeredEmail && (
          <Banner
            tone="success"
            title="Cadastro concluído"
            description="Entre com o e-mail e a senha que você acabou de cadastrar."
          />
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField label="E-mail" required>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com.br"
              autoComplete="email"
            />
          </FormField>

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

          <Button type="submit" icon={LuLogIn} isLoading={isLoading} fullWidth disabled={!email.trim() || !password}>
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
