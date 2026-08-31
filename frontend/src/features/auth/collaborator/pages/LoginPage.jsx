import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLogIn } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { mockDelay } from '../../../../hooks/useMockApi.js';
import { ROUTES } from '../../../../constants/routes.js';
import authStyles from '../../../../styles/authCard.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) navigate(ROUTES.home);
    else setError(result.body.message);
  };

  return (
    <Card tone="dark" className={authStyles.card}>
      <Card.Body>
        <p className={authStyles.eyebrow}>DocsUp</p>
        <h1 className={authStyles.title}>Entrar</h1>
        <p className={authStyles.subtitle}>Acesse com seu e-mail corporativo para acompanhar solicitacoes, cotacoes e documentacao.</p>

        <form className={authStyles.form} onSubmit={handleSubmit}>
          <FormField label="E-mail corporativo" required>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome.sobrenome@everestengenharia.com.br"
              autoFocus
            />
          </FormField>
          <FormField label="Senha" required>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" />
          </FormField>

          {error && <Banner tone="danger" description={error} />}

          <Button type="submit" icon={LuLogIn} isLoading={isLoading} fullWidth>
            Entrar
          </Button>
        </form>
      </Card.Body>
    </Card>
  );
}
