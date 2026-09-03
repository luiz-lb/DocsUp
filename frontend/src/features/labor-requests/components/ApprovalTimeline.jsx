import Timeline from '../../../components/ui/Timeline/index.js';
import { APPROVAL_DECISION, DEPARTMENT } from '../../../constants/enums.js';

const TONE_BY_DECISION = { 0: 'warning', 1: 'danger', 2: 'success' };

/**
 * Mapeia labor_request_approvals (formato do backend) para o Timeline genérico.
 * Suporta tanto o formato do backend real (snake_case) quanto dados locais.
 */
export default function ApprovalTimeline({ approvals = [] }) {
  const items = approvals.map((approval) => {
    // Suporta snake_case (backend) e camelCase (mocks legados)
    const decision = approval.decision ?? 0;
    const decidedAt = approval.decided_at ?? approval.decidedAt ?? null;
    const comments = approval.comments ?? null;
    const department = approval.department ?? null;
    const approverName = approval.approver_name ?? approval.approverName ?? null;

    const deptLabel = department !== null
      ? (DEPARTMENT[department]?.label ?? `Depto ${department}`)
      : approval.department_label ?? '';

    const decisionLabel = APPROVAL_DECISION[decision]?.label ?? 'Pendente';

    return {
      title: `${deptLabel}: ${decisionLabel}`,
      description: [
        approverName ? `Por: ${approverName}` : null,
        comments || null,
      ]
        .filter(Boolean)
        .join(' — ') || null,
      at: decidedAt,
      tone: TONE_BY_DECISION[decision] ?? 'neutral',
    };
  });

  return <Timeline items={items} />;
}
