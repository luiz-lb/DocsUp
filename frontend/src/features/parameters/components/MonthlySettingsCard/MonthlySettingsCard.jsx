import { useEffect, useState } from 'react';
import { LuCalendarClock, LuSave } from 'react-icons/lu';
import { Banner, Button, Card, FormField } from '../../../../components/ui/index.js';
import { getSettings, updateSettings } from '../../api/parametersApi.js';
import styles from './MonthlySettingsCard.module.css';

/**
 * Dia limite dos documentos trabalhistas mensais (Admin): os documentos de um mês vencem
 * nesse dia do mês seguinte. Ex.: dia 10 → os de outubro vencem em 10 de novembro.
 */
export default function MonthlySettingsCard() {
  const [dueDay, setDueDay] = useState('');
  const [maxDueDay, setMaxDueDay] = useState(28);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    getSettings().then((result) => {
      if (!active) return;
      if (result.success) {
        setDueDay(String(result.body.monthlyDueDay));
        setMaxDueDay(result.body.maxDueDay ?? 28);
      } else {
        setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao buscar os parâmetros.' });
      }
      setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    setFeedback(null);
    const day = Number(dueDay);
    if (!Number.isInteger(day) || day < 1 || day > maxDueDay) {
      setFeedback({ tone: 'danger', message: `Informe um dia de 1 a ${maxDueDay}.` });
      return;
    }
    setIsSaving(true);
    const result = await updateSettings({ monthlyDueDay: day });
    setIsSaving(false);
    setFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Dia limite atualizado.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
  };

  return (
    <Card>
      <Card.Body>
        <div className={styles.row}>
          <div className={styles.text}>
            <h3 className={styles.title}><LuCalendarClock aria-hidden="true" /> Dia limite dos documentos mensais</h3>
            <p className={styles.note}>
              Os tipos ativos desta aba são cobrados todo mês, de todos os fornecedores com contrato em andamento, desde o mês
              de início da solicitação até o contrato ser concluído. Os documentos de um mês vencem neste dia do mês seguinte.
            </p>
          </div>
          <div className={styles.form}>
            <FormField label="Dia do mês seguinte" className={styles.field}>
              <input
                type="number"
                min="1"
                max={maxDueDay}
                step="1"
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
                disabled={isLoading || isSaving}
              />
            </FormField>
            <Button icon={LuSave} size="sm" onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
              Salvar
            </Button>
          </div>
        </div>
        {dueDay && Number(dueDay) >= 1 && (
          <p className={styles.example}>Ex.: os documentos de outubro vencem em {dueDay} de novembro.</p>
        )}
        {feedback && <Banner tone={feedback.tone} description={feedback.message} />}
      </Card.Body>
    </Card>
  );
}
