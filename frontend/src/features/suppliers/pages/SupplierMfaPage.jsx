import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LuShieldCheck } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import styles from '../../../styles/authCard.module.css';

export default function SupplierMfaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginPhase2 } = useSupplierAuth();

  // Em ambiente de desenvolvimento o backend devolve o OTP no body do login
  const devOtp = location.state?.devOtp ?? null;
  // Token de proposta propagado desde a tela de login
  const tokenProposta = location.state?.tokenProposta ?? null;

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginPhase2(code);
    setIsLoading(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Código inválido. Confira o e-mail enviado.');
      return;
    }

    // Se veio com token de proposta, abre direto a cotação apontada
    if (tokenProposta) {
      navigate(ROUTES.quotations.submit(tokenProposta));
      return;
    }

    // Caso padrão: portal do fornecedor com a lista de cotações
    navigate(ROUTES.suppliers.portal);
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Confirme sua identidade</h1>
        <p className={styles.subtitle}>
          Enviamos um código de 6 dígitos para o e-mail do responsável legal e do responsável operacional cadastrados.
        </p>

        {/* Aviso de código de desenvolvimento — nunca aparece em produção */}
        {devOtp && (
          <Banner
            tone="warning"
            title="Modo de desenvolvimento"
            description={`Código OTP (visível apenas em dev): ${devOtp}`}
          />
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField label="Código de verificação" required>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </FormField>

          {error && <Banner tone="danger" description={error} />}

          <Button
            type="submit"
            icon={LuShieldCheck}
            isLoading={isLoading}
            fullWidth
            disabled={code.length !== 6}
          >
            Confirmar
          </Button>
        </form>

        <button
          type="button"
          className={styles.registerLink}
          onClick={() => navigate(ROUTES.suppliers.login)}
        >
          Voltar ao login
        </button>
      </Card.Body>
    </Card>
  );
}
