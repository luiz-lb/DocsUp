import { FormField } from '../../../../components/ui/index.js';
import { cn } from '../../../../utils/cn.js';
import styles from './SupplierInviteModal.module.css';

// Atalhos de prazo em horas
const QUICK_HOURS = [24, 48, 72];

/** Valor inicial do campo: 72 horas. */
export const DEFAULT_DEADLINE = { mode: 'hours', hours: '72', until: '' };

/** 'AAAA-MM-DDTHH:mm' de agora + 1 hora (mínimo do datetime-local). */
function minDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Payload do prazo para o backend: { deadlineHours } ou { deadlineAt }, ou { error }.
 * O backend confere de novo (1 a 720 horas; data futura até 1 ano).
 */
export function deadlinePayload(value) {
  if (value.mode === 'hours') {
    const hours = Number(value.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      return { error: 'Informe o prazo em horas (um número inteiro de 1 a 720).' };
    }
    return { deadlineHours: hours };
  }
  if (!value.until) return { error: 'Informe a data e a hora do prazo.' };
  if (new Date(value.until) <= new Date()) return { error: 'O prazo tem que ser uma data e hora futuras.' };
  return { deadlineAt: value.until };
}

/** Texto do prazo escolhido, para a confirmação na tela. */
export function describeDeadline(value) {
  if (value.mode === 'hours') {
    const hours = Number(value.hours);
    if (!Number.isInteger(hours) || hours < 1) return '';
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    return `Até ${until.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} (${hours} h a partir de agora)`;
  }
  if (!value.until) return '';
  return `Até ${new Date(value.until).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

/**
 * Prazo dos documentos iniciais: em horas (24 h, 48 h, 72 h ou outro valor) ou até uma data
 * e hora. value = { mode: 'hours' | 'date', hours, until }.
 */
export default function DeadlineField({ value, onChange, disabled = false }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className={styles.deadline}>
      <span className={styles.deadlineLabel}>Prazo para enviar os documentos iniciais</span>
      <div className={styles.segmented} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={value.mode === 'hours'}
          className={cn(styles.segment, value.mode === 'hours' && styles.segmentActive)}
          onClick={() => set({ mode: 'hours' })}
          disabled={disabled}
        >
          Em horas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value.mode === 'date'}
          className={cn(styles.segment, value.mode === 'date' && styles.segmentActive)}
          onClick={() => set({ mode: 'date' })}
          disabled={disabled}
        >
          Até uma data
        </button>
      </div>

      {value.mode === 'hours' ? (
        <div className={styles.hoursRow}>
          {QUICK_HOURS.map((hours) => (
            <button
              key={hours}
              type="button"
              className={cn(styles.quick, String(hours) === String(value.hours) && styles.quickActive)}
              onClick={() => set({ hours: String(hours) })}
              disabled={disabled}
            >
              {hours} h
            </button>
          ))}
          <FormField className={styles.hoursField}>
            <input
              type="number"
              min="1"
              max="720"
              step="1"
              value={value.hours}
              onChange={(event) => set({ hours: event.target.value })}
              aria-label="Prazo em horas"
              disabled={disabled}
            />
          </FormField>
          <span className={styles.hoursSuffix}>horas</span>
        </div>
      ) : (
        <FormField>
          <input
            type="datetime-local"
            value={value.until}
            min={minDateTime()}
            onChange={(event) => set({ until: event.target.value })}
            aria-label="Prazo até"
            disabled={disabled}
          />
        </FormField>
      )}

      {describeDeadline(value) && <p className={styles.deadlineHint}>{describeDeadline(value)}</p>}
    </div>
  );
}
