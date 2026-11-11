import { useCallback, useEffect, useState } from 'react';
import { LuBellRing, LuMailCheck, LuRefreshCw, LuRotateCcw, LuSave, LuSlidersHorizontal } from 'react-icons/lu';
import { Banner, Button, Card, DataTable, FormField, Pagination, StatusBadge } from '../../../../components/ui/index.js';
import { DELIVERY_STATUS, DELIVERY_STATUS_ID, NOTIFICATION_AUDIENCE } from '../../../../constants/enums.js';
import { formatDateTime } from '../../../../utils/formatters.js';
import {
  getSettings, listNotificationDeliveries, retryNotificationDelivery, updateSettings,
} from '../../api/parametersApi.js';
import styles from './NotificationsTab.module.css';

const NUMBER_FIELDS = [
  { key: 'rhDigestIntervalHours', label: 'Resumo do RH a cada (horas)', min: 1, max: 24, hint: 'Só sai e-mail se houver novidade.' },
  { key: 'initialDeadlineReminderHours', label: 'Lembrete do prazo dos iniciais (horas antes)', min: 1, max: 168, hint: 'Para o fornecedor que ainda não enviou tudo.' },
  { key: 'scheduledHour', label: 'Horário dos avisos dos mensais (0 a 23 h)', min: 0, max: 23, hint: 'Abertura, lembrete, último dia e atraso.' },
];

// Status que dá para reenviar
const RETRYABLE = [DELIVERY_STATUS_ID.FALHOU, DELIVERY_STATUS_ID.FILA_DE_ERRO, DELIVERY_STATUS_ID.NAO_ENVIADO];

// Filtros rápidos dos envios
const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: String(DELIVERY_STATUS_ID.ENVIADO), label: 'Enviados' },
  { value: `${DELIVERY_STATUS_ID.FALHOU},${DELIVERY_STATUS_ID.FILA_DE_ERRO}`, label: 'Com falha' },
  { value: String(DELIVERY_STATUS_ID.NAO_ENVIADO), label: 'Não enviados' },
  { value: `${DELIVERY_STATUS_ID.NA_FILA},${DELIVERY_STATUS_ID.ENVIANDO}`, label: 'Na fila' },
];

/**
 * Parâmetros → Notificações (Admin): intervalo do resumo do RH, lembretes, quais avisos saem
 * e os últimos envios (com reenviar o que falhou).
 */
export default function NotificationsTab() {
  const [settings, setSettings] = useState(null);
  const [numbers, setNumbers] = useState({});
  const [toggles, setToggles] = useState({});
  const [settingsFeedback, setSettingsFeedback] = useState(null);
  const [isSavingNumbers, setIsSavingNumbers] = useState(false);
  const [isSavingToggles, setIsSavingToggles] = useState(false);

  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deliveries, setDeliveries] = useState(null);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(true);
  const [deliveryFeedback, setDeliveryFeedback] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const applySettings = (body) => {
    setSettings(body);
    setNumbers(Object.fromEntries(NUMBER_FIELDS.map((field) => [field.key, String(body.notifications[field.key])])));
    setToggles(Object.fromEntries(body.notifications.types.map((item) => [item.type, item.enabled])));
  };

  useEffect(() => {
    let active = true;
    getSettings().then((result) => {
      if (!active) return;
      if (result.success) applySettings(result.body);
      else setSettingsFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao buscar os parâmetros.' });
    });
    return () => { active = false; };
  }, []);

  const loadDeliveries = useCallback(async () => {
    setIsLoadingDeliveries(true);
    const result = await listNotificationDeliveries({ status: filter, page, pageSize });
    setIsLoadingDeliveries(false);
    if (result.success) setDeliveries(result.body);
    else setDeliveryFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao buscar os envios.' });
  }, [filter, page, pageSize]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  const saveNumbers = async () => {
    setSettingsFeedback(null);
    const payload = {};
    for (const field of NUMBER_FIELDS) {
      const value = Number(numbers[field.key]);
      if (!Number.isInteger(value) || value < field.min || value > field.max) {
        setSettingsFeedback({ tone: 'danger', message: `${field.label}: use um número de ${field.min} a ${field.max}.` });
        return;
      }
      payload[field.key] = value;
    }
    setIsSavingNumbers(true);
    const result = await updateSettings(payload);
    setIsSavingNumbers(false);
    setSettingsFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Parâmetros salvos.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
    if (result.success) {
      const fresh = await getSettings();
      if (fresh.success) applySettings(fresh.body);
    }
  };

  const saveToggles = async () => {
    setSettingsFeedback(null);
    setIsSavingToggles(true);
    const result = await updateSettings({ notificationsEnabled: toggles });
    setIsSavingToggles(false);
    setSettingsFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Avisos salvos.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
    if (result.success) {
      const fresh = await getSettings();
      if (fresh.success) applySettings(fresh.body);
    }
  };

  const handleRetry = async (row) => {
    setDeliveryFeedback(null);
    setRetryingId(row.id);
    const result = await retryNotificationDelivery(row.id);
    setRetryingId(null);
    setDeliveryFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Reenvio pedido.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao pedir o reenvio.' });
    loadDeliveries();
  };

  const numbersChanged = settings && NUMBER_FIELDS.some((field) => numbers[field.key] !== String(settings.notifications[field.key]));
  const togglesChanged = settings && settings.notifications.types.some((item) => toggles[item.type] !== item.enabled);
  const groups = settings
    ? Object.entries(NOTIFICATION_AUDIENCE)
      .map(([audience, info]) => ({ audience, info, items: settings.notifications.types.filter((item) => item.audience === audience) }))
      .filter((group) => group.items.length > 0)
    : [];

  const counts = deliveries?.counts ?? {};
  const columns = [
    { key: 'createdAt', header: 'Quando', width: '9rem', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'eventLabel',
      header: 'Aviso',
      render: (row) => (
        <div>
          <strong className={styles.eventLabel}>{row.eventLabel}</strong>
          {row.subject && <span className={styles.subject}>{row.subject}</span>}
        </div>
      ),
    },
    { key: 'recipient', header: 'Para', render: (row) => <span className={styles.recipient}>{row.recipient}</span> },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => (
        <div className={styles.statusCell}>
          <StatusBadge enumMap={DELIVERY_STATUS} value={row.status} />
          <span className={styles.attempts}>
            {row.status === DELIVERY_STATUS_ID.ENVIADO && row.sentAt ? `em ${formatDateTime(row.sentAt)}` : `${row.attempts} tentativa${row.attempts === 1 ? '' : 's'}`}
          </span>
          {row.lastError && row.status !== DELIVERY_STATUS_ID.ENVIADO && <span className={styles.error}>{row.lastError}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '7.5rem',
      render: (row) => (RETRYABLE.includes(row.status) ? (
        <Button size="sm" variant="secondary" icon={LuRotateCcw} onClick={() => handleRetry(row)} isLoading={retryingId === row.id}>
          Reenviar
        </Button>
      ) : null),
    },
  ];

  return (
    <div className={styles.wrapper}>
      {settingsFeedback && <Banner tone={settingsFeedback.tone} description={settingsFeedback.message} />}

      <Card>
        <Card.Body>
          <h3 className={styles.title}><LuSlidersHorizontal aria-hidden="true" /> Prazos dos avisos</h3>
          <p className={styles.note}>
            Os avisos ao fornecedor saem na hora. O RH recebe um resumo do que chegou no período (documentos enviados e reenviados);
            sem novidade, nenhum e-mail sai.
          </p>
          <div className={styles.form}>
            {NUMBER_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label} hint={field.hint} className={styles.field}>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step="1"
                  value={numbers[field.key] ?? ''}
                  onChange={(event) => setNumbers((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  disabled={!settings || isSavingNumbers}
                />
              </FormField>
            ))}
            <Button icon={LuSave} size="sm" onClick={saveNumbers} isLoading={isSavingNumbers} disabled={!numbersChanged}>
              Salvar
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <h3 className={styles.title}><LuBellRing aria-hidden="true" /> Avisos por e-mail</h3>
          <p className={styles.note}>Desligue um aviso para ele parar de sair. Os já enviados continuam no histórico abaixo.</p>
          {groups.map((group) => (
            <div key={group.audience} className={styles.group}>
              <p className={styles.groupTitle}>{group.info.label}</p>
              <p className={styles.groupNote}>{group.info.description}</p>
              <ul className={styles.toggleList}>
                {group.items.map((item) => (
                  <li key={item.type}>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={Boolean(toggles[item.type])}
                        onChange={(event) => setToggles((prev) => ({ ...prev, [item.type]: event.target.checked }))}
                        disabled={isSavingToggles}
                      />
                      <span>
                        <strong>{item.label}</strong>
                        <span className={styles.toggleDescription}>{item.description}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Button icon={LuSave} size="sm" onClick={saveToggles} isLoading={isSavingToggles} disabled={!togglesChanged}>
            Salvar avisos
          </Button>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div className={styles.deliveriesHeader}>
            <h3 className={styles.title}><LuMailCheck aria-hidden="true" /> Últimos envios</h3>
            <Button size="sm" variant="secondary" icon={LuRefreshCw} onClick={loadDeliveries} isLoading={isLoadingDeliveries}>
              Atualizar
            </Button>
          </div>
          {deliveries && !deliveries.mailEnabled && (
            <Banner
              tone="warning"
              description="O envio de e-mail (Microsoft Graph) está desligado no servidor: preencha as variáveis GRAPH_* no .env. Os avisos ficam como &quot;Não enviado&quot;; depois de ligar, dá para reenviar."
            />
          )}
          <div className={styles.filters} role="group" aria-label="Filtrar envios">
            {STATUS_FILTERS.map((item) => {
              const total = item.value === ''
                ? Object.values(counts).reduce((sum, value) => sum + value, 0)
                : item.value.split(',').reduce((sum, value) => sum + (counts[value] ?? 0), 0);
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.filter} ${filter === item.value ? styles.filterActive : ''}`}
                  onClick={() => { setFilter(item.value); setPage(1); }}
                >
                  {item.label} <span className={styles.filterCount}>{total}</span>
                </button>
              );
            })}
          </div>
          {deliveryFeedback && <Banner tone={deliveryFeedback.tone} description={deliveryFeedback.message} />}
          <DataTable
            columns={columns}
            rows={deliveries?.deliveries ?? []}
            isLoading={isLoadingDeliveries}
            stackOnMobile
            emptyTitle="Nenhum envio"
            emptyDescription="Os avisos aparecem aqui quando o serviço de notificações enviar."
          />
          {deliveries && deliveries.total > pageSize && (
            <Pagination
              page={page}
              totalPages={Math.ceil(deliveries.total / pageSize)}
              totalItems={deliveries.total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
