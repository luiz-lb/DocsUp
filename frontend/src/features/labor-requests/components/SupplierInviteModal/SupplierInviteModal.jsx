import { useEffect, useState } from 'react';
import { LuCheck, LuCopy, LuMail, LuRefreshCw, LuRepeat, LuTimer } from 'react-icons/lu';
import { Banner, Button, FormField, Modal } from '../../../../components/ui/index.js';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue.js';
import { formatCnpj } from '../../../../utils/formatters.js';
import { isValidEmail } from '../../../../utils/validators.js';
import {
  assignSupplier,
  changeSupplierDeadline,
  lookupSupplierEmail,
  replaceSupplier,
  resendSupplierInvite,
} from '../../api/laborRequestsApi.js';
import DeadlineField, { DEFAULT_DEADLINE, deadlinePayload } from './DeadlineField.jsx';
import styles from './SupplierInviteModal.module.css';

// O que cada modo pede e faz
const MODES = {
  assign: {
    title: 'Indicar fornecedor',
    submitLabel: 'Indicar fornecedor',
    icon: LuMail,
    askEmail: true,
    askReason: false,
    action: (id, payload) => assignSupplier(id, payload),
  },
  resend: {
    title: 'Reenviar convite',
    submitLabel: 'Reenviar e recomeçar',
    icon: LuRefreshCw,
    askEmail: false,
    askReason: false,
    action: (id, payload) => resendSupplierInvite(id, payload),
  },
  deadline: {
    title: 'Mudar o prazo dos documentos',
    submitLabel: 'Salvar novo prazo',
    icon: LuTimer,
    askEmail: false,
    askReason: false,
    action: (id, payload) => changeSupplierDeadline(id, payload),
  },
  replace: {
    title: 'Trocar fornecedor',
    submitLabel: 'Trocar fornecedor',
    icon: LuRepeat,
    askEmail: true,
    askReason: true,
    action: (id, payload) => replaceSupplier(id, payload),
  },
};

const REASON_MAX_LENGTH = 1000;

/**
 * Ações de Compras sobre o fornecedor da solicitação, num modal só:
 *  - assign   : indicar pelo e-mail + prazo (mostra se o e-mail já tem cadastro);
 *  - resend   : reenviar para o mesmo e-mail + novo prazo (recomeça do zero);
 *  - deadline : só o novo prazo;
 *  - replace  : novo e-mail + motivo + prazo (o fornecedor atual perde o acesso).
 * Quando há link do convite, a tela final mostra o link para copiar (com o e-mail
 * desligado, é assim que ele chega ao fornecedor).
 *
 * Props: open, mode, laborRequestId, currentEmail (resend / replace), onClose, onSuccess(message)
 */
export default function SupplierInviteModal({ open, mode = 'assign', laborRequestId, currentEmail, onClose, onSuccess }) {
  const config = MODES[mode] ?? MODES.assign;

  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE);
  const [lookup, setLookup] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);

  // Cada abertura começa limpa
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setReason('');
    setDeadline(DEFAULT_DEADLINE);
    setLookup(null);
    setError('');
    setDone(null);
    setCopied(false);
  }, [open, mode]);

  // Mostra se o e-mail já tem cadastro no portal (CNPJ e razão social)
  const debouncedEmail = useDebouncedValue(email.trim(), 400);
  useEffect(() => {
    if (!open || !config.askEmail || !isValidEmail(debouncedEmail)) {
      setLookup(null);
      return undefined;
    }
    let active = true;
    lookupSupplierEmail(debouncedEmail).then((result) => {
      if (active && result.success) setLookup(result.body);
    });
    return () => { active = false; };
  }, [debouncedEmail, open, config.askEmail]);

  const handleSubmit = async () => {
    setError('');
    if (config.askEmail && !isValidEmail(email.trim())) {
      setError('Informe um e-mail válido do fornecedor.');
      return;
    }
    if (config.askReason && reason.trim().length < 5) {
      setError('Informe o motivo da troca do fornecedor.');
      return;
    }
    const deadlineValue = deadlinePayload(deadline);
    if (deadlineValue.error) {
      setError(deadlineValue.error);
      return;
    }

    setIsSubmitting(true);
    const result = await config.action(laborRequestId, {
      ...(config.askEmail ? { email: email.trim() } : {}),
      ...(config.askReason ? { reason: reason.trim() } : {}),
      ...deadlineValue,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Não foi possível concluir. Tente novamente.');
      return;
    }

    // Com link do convite: mostra para copiar antes de fechar
    if (result.body?.inviteLink) {
      setDone(result.body);
      return;
    }
    onSuccess?.(result.body?.message ?? 'Feito.');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(done.inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const finish = () => onSuccess?.(done?.message ?? 'Feito.');

  return (
    <Modal
      open={open}
      onClose={done ? finish : onClose}
      title={config.title}
      maxWidth="sm"
      actions={
        done ? (
          <Button icon={LuCheck} onClick={finish}>Concluir</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button icon={config.icon} onClick={handleSubmit} isLoading={isSubmitting}>
              {config.submitLabel}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className={styles.form}>
          <Banner tone="success" description={done.message} />
          <p className={styles.text}>
            {done.mailEnabled
              ? 'O convite foi enviado por e-mail. Se preferir, copie o link e envie também por outro meio.'
              : 'O envio de e-mail está desligado: copie o link abaixo e envie ao fornecedor (WhatsApp, e-mail próprio…).'}
          </p>
          <div className={styles.linkRow}>
            <input className={styles.linkInput} value={done.inviteLink} readOnly onFocus={(event) => event.target.select()} />
            <Button size="sm" variant="secondary" icon={copied ? LuCheck : LuCopy} onClick={handleCopy}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <p className={styles.hint}>
            Quem abrir o link entra no portal (ou se cadastra) e vê a declaração dos documentos.
            Se o e-mail já tiver cadastro, a solicitação também aparece em “Meus contratos”.
          </p>
        </div>
      ) : (
        <div className={styles.form}>
          {mode === 'resend' && (
            <Banner
              tone="info"
              description={`O convite vai de novo para ${currentEmail}. O fornecedor recomeça do zero: nova declaração, novo link e novo prazo. O link anterior deixa de funcionar.`}
            />
          )}
          {mode === 'replace' && (
            <Banner
              tone="warning"
              description={`O fornecedor atual (${currentEmail}) perde o acesso a esta solicitação. Os documentos que ele já enviou ficam guardados.`}
            />
          )}

          {config.askEmail && (
            <FormField
              label={mode === 'replace' ? 'E-mail do novo fornecedor' : 'E-mail do fornecedor'}
              required
              hint="Pode ser o e-mail do Responsável ou do Operador da empresa."
            >
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="fornecedor@empresa.com.br"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </FormField>
          )}
          {config.askEmail && lookup && (
            lookup.registered ? (
              <div className={styles.lookupFound}>
                <strong>{lookup.supplier.razaoSocial}</strong>
                <span>CNPJ {formatCnpj(lookup.supplier.cnpj)} · {lookup.user.name}</span>
                <span className={styles.lookupNote}>
                  {lookup.emailVerified
                    ? 'Já tem cadastro: a solicitação aparece direto no portal dele.'
                    : 'Tem cadastro, mas o e-mail ainda não foi confirmado: a solicitação aparece quando esse usuário entrar no portal ou abrir o link.'}
                </span>
              </div>
            ) : (
              <div className={styles.lookupNew}>
                E-mail sem cadastro no portal: o link do convite leva ao cadastro do fornecedor.
              </div>
            )
          )}

          {config.askReason && (
            <FormField label="Motivo da troca" required hint="Fica registrado no histórico e na auditoria.">
              <textarea
                rows={3}
                value={reason}
                maxLength={REASON_MAX_LENGTH}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex.: não entregou os documentos dentro do prazo."
                disabled={isSubmitting}
              />
            </FormField>
          )}

          <DeadlineField value={deadline} onChange={setDeadline} disabled={isSubmitting} />

          {error && <Banner tone="danger" description={error} />}
        </div>
      )}
    </Modal>
  );
}
