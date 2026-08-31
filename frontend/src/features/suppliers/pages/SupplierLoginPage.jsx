import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLogIn, LuUserPlus } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { loginSupplier } from '../api/suppliersApi.js';
import CnpjField from '../components/CnpjField.jsx';
import styles from '../../../styles/authCard.module.css';

export default function SupplierLoginPage() {
  const navigate = useNavigate();
  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await loginSupplier(cnpj);
    setIsLoading(false);

    if (result.requiresMfa) {
      navigate(ROUTES.suppliers.mfa);
    } else {
      setError('Nao foi possivel autenticar. Verifique o CNPJ e a senha.');
    }
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Acesse com o CNPJ e a senha cadastrados para responder a cotacao.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <CnpjField value={cnpj} onChange={setCnpj} />
          <FormField label="Senha" required>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" />
          </FormField>

          {error && <Banner tone="danger" description={error} />}

          <Button type="submit" icon={LuLogIn} isLoading={isLoading} fullWidth>
            Entrar
          </Button>
        </form>

        <button type="button" className={styles.registerLink} onClick={() => navigate(ROUTES.suppliers.register)}>
          <LuUserPlus /> Ainda nao tenho cadastro
        </button>
      </Card.Body>
    </Card>
  );
}
