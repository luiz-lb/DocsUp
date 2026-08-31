import { mockDelay } from '../../../hooks/useMockApi.js';

const phase2Deadlines = [
  {
    id: 1,
    token: 'phase2-demo',
    quotationId: 5001,
    supplierName: 'Eletro Instala',
    laborRequestTitle: 'Equipe de instalacao eletrica - Torre B',
    deadlineHours: 72,
    startedAt: '2026-08-05T09:32:00Z',
    expiresAt: '2026-08-08T09:32:00Z',
    status: 0,
  },
];

let employeeSeq = 3;
const employees = [
  { id: 1, supplierName: 'Eletro Instala', fullName: 'Jose Almeida', roleFunction: 'Eletricista', nrIds: [10, 12], status: 1 },
  { id: 2, supplierName: 'Eletro Instala', fullName: 'Katia Ferreira', roleFunction: 'Auxiliar Eletrica', nrIds: [10], status: 0 },
];

export function getPhase2ByToken(token) {
  const deadline = phase2Deadlines.find((item) => item.token === token) ?? phase2Deadlines[0];
  const linkedEmployees = employees.filter((employee) => employee.supplierName === deadline.supplierName);
  return mockDelay({ deadline, employees: linkedEmployees });
}

export function addEmployee(token, employeeData) {
  const deadline = phase2Deadlines.find((item) => item.token === token) ?? phase2Deadlines[0];
  employeeSeq += 1;
  const record = { id: employeeSeq, supplierName: deadline.supplierName, status: 0, ...employeeData };
  employees.push(record);
  return mockDelay(record, 400);
}

export function listEmployees() {
  return mockDelay([...employees]);
}
