import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLogIn, LuUserPlus } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import CnpjField from '../components/CnpjField.jsx';
import styles from '../../../styles/authCard.module.css';

export default function SupplierLoginPage() {
  const navigate = useNavigate();
  const { loginPhase1 } = useSupplierAuth();

  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginPhase1(cnpj, password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Não foi possível autenticar. Verifique o CNPJ e a senha.');
      return;
    }

    if (result.body?.requiresMfa) {
      // Passa o devOtp via state para exibir na tela de MFA em ambiente de dev
      navigate(ROUTES.suppliers.mfa, {
        state: { devOtp: result.body?.devOtp ?? null },
      });
    }
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Acesse com o CNPJ e a senha cadastrados para responder à cotação.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <CnpjField value={cnpj} onChange={setCnpj} />

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
          onClick={() => navigate(ROUTES.suppliers.register)}
        >
          <LuUserPlus /> Ainda não tenho cadastro
        </button>
      </Card.Body>
    </Card>
  );
}
