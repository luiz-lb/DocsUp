import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuShieldCheck } from 'react-icons/lu';
import { Card, Button, FormField, Banner } from '../../../components/ui/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { verifyMfaCode } from '../api/suppliersApi.js';
import styles from '../../../styles/authCard.module.css';

export default function SupplierMfaPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await verifyMfaCode(code);
    setIsLoading(false);

    if (result.success) {
      navigate(ROUTES.quotations.submit('demo-token'));
    } else {
      setError('Codigo invalido. Confira o e-mail enviado ao responsavel legal e operacional.');
    }
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={styles.title}>Confirme sua identidade</h1>
        <p className={styles.subtitle}>
          Enviamos um codigo de 6 digitos para o e-mail do responsavel legal e do responsavel operacional cadastrados.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField label="Codigo de verificacao" required>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
            />
          </FormField>

          {error && <Banner tone="danger" description={error} />}

          <Button type="submit" icon={LuShieldCheck} isLoading={isLoading} fullWidth>
            Confirmar
          </Button>
        </form>
      </Card.Body>
    </Card>
  );
}
