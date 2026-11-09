import { useEffect, useState } from 'react';
import { LuCalendarClock, LuSave } from 'react-icons/lu';
import { Banner, Button, Card, FormField } from '../../../../components/ui/index.js';
import { getSettings, updateSettings } from '../../api/parametersApi.js';
import styles from './MonthlySettingsCard.module.css';

const FIELDS = [
  { key: 'openDay', payload: 'monthlyOpenDay', label: 'Abre no dia', hint: 'aviso a todos os fornecedores' },
  { key: 'reminderDay', payload: 'monthlyReminderDay', label: 'Lembrete no dia', hint: 'para quem ainda tem pendência' },
  { key: 'dueDay', payload: 'monthlyDueDay', label: 'Último dia do prazo', hint: 'depois disso fica atrasado' },
];

/**
 * Calendário dos documentos trabalhistas mensais (Admin). Os documentos de um mês são
 * enviados no mês seguinte: abrem no dia de abertura, recebem lembrete e vencem no fim do
 * último dia. Ex.: 1, 19 e 21 → os de outubro abrem em 1º/11, lembrete em 19/11 e vencem em 21/11.
 */
export default function MonthlySettingsCard() {
  const [form, setForm] = useState({ openDay: '', reminderDay: '', dueDay: '' });
  const [saved, setSaved] = useState(null);
  const [maxDay, setMaxDay] = useState(28);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let active = true;
    getSettings().then((result) => {
      if (!active) return;
      if (result.success) {
        const monthly = result.body.monthly;
        const values = { openDay: String(monthly.openDay), reminderDay: String(monthly.reminderDay), dueDay: String(monthly.dueDay) };
        setForm(values);
        setSaved(values);
        setMaxDay(monthly.maxDay ?? 28);
      } else {
        setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao buscar os parâmetros.' });
      }
      setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const days = FIELDS.map((field) => Number(form[field.key]));
  const valid = days.every((day) => Number.isInteger(day) && day >= 1 && day <= maxDay) && days[0] < days[1] && days[1] < days[2];
  const changed = saved && FIELDS.some((field) => form[field.key] !== saved[field.key]);

  const handleSave = async () => {
    setFeedback(null);
    if (!valid) {
      setFeedback({ tone: 'danger', message: `Use dias de 1 a ${maxDay}, com a abertura antes do lembrete e o lembrete antes do último dia.` });
      return;
    }
    setIsSaving(true);
    const payload = Object.fromEntries(FIELDS.map((field, index) => [field.payload, days[index]]));
    const result = await updateSettings(payload);
    setIsSaving(false);
    if (result.success) setSaved({ ...form });
    setFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Calendário atualizado.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
  };

  return (
    <Card>
      <Card.Body>
        <div className={styles.row}>
          <div className={styles.text}>
            <h3 className={styles.title}><LuCalendarClock aria-hidden="true" /> Calendário dos documentos mensais</h3>
            <p className={styles.note}>
              Os tipos ativos desta aba são cobrados todo mês, de todos os fornecedores com contrato em andamento, desde o mês
              de início da solicitação até o contrato ser concluído. Os documentos de um mês são enviados no mês seguinte.
            </p>
          </div>
        </div>
        <div className={styles.form}>
          {FIELDS.map((field) => (
            <FormField key={field.key} label={field.label} hint={field.hint} className={styles.field}>
              <input
                type="number"
                min="1"
                max={maxDay}
                step="1"
                value={form[field.key]}
                onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                disabled={isLoading || isSaving}
              />
            </FormField>
          ))}
          <Button icon={LuSave} size="sm" onClick={handleSave} isLoading={isSaving} disabled={isLoading || !changed}>
            Salvar
          </Button>
        </div>
        {valid && (
          <p className={styles.example}>
            Ex.: os documentos de outubro abrem em {days[0]}/11, recebem lembrete em {days[1]}/11 e vencem no fim do dia {days[2]}/11.
            Enviados depois, ficam como atrasados.
          </p>
        )}
        {feedback && <Banner tone={feedback.tone} description={feedback.message} />}
      </Card.Body>
    </Card>
  );
}
