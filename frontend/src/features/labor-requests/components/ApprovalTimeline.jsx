import Timeline from '../../../components/ui/Timeline/index.js';
import { APPROVAL_DECISION } from '../../../constants/enums.js';

const TONE_BY_DECISION = { 0: 'warning', 1: 'danger', 2: 'success' };

/** Mapeia labor_request_approvals para o Timeline generico do design system. */
export default function ApprovalTimeline({ approvals }) {
  const items = approvals.map((approval) => ({
    title: `${approval.department}: ${APPROVAL_DECISION[approval.decision].label}`,
    description: approval.comments,
    at: approval.decidedAt,
    tone: TONE_BY_DECISION[approval.decision],
  }));

  return <Timeline items={items} />;
}
