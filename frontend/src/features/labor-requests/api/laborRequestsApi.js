import { mockDelay } from '../../../hooks/useMockApi.js';
import { ACTIVITY_TYPES } from '../../../mocks/catalog.js';
import { api } from '../../../utils/api.js';

let seq = 104;
const requests = [
  {
    id: 101,
    title: 'Equipe de instalacao eletrica - Torre B',
    activityTypeId: 1,
    location: 'Obra Torre B - Alphaville',
    headcount: 6,
    urgency: 2,
    status: 3,
    requiredDocumentIds: [1, 2, 3, 5],
    requesterName: 'Marcelo Dias',
    createdAt: '2026-07-28T13:20:00Z',
    approvals: [
      { department: 'RH', decision: 2, comments: 'Escopo compativel com o efetivo atual.', decidedAt: '2026-07-28T16:40:00Z' },
      { department: 'Seguranca', decision: 2, comments: 'Checklist de NR-10 e NR-12 anexado.', decidedAt: '2026-07-29T09:10:00Z' },
    ],
  },
  {
    id: 102,
    title: 'Solda estrutural - Galpao 4',
    activityTypeId: 3,
    location: 'Obra Galpao 4 - Barueri',
    headcount: 4,
    urgency: 3,
    status: 0,
    requiredDocumentIds: [1, 2, 3, 4, 5, 6],
    requesterName: 'Marcelo Dias',
    createdAt: '2026-08-02T10:05:00Z',
    approvals: [
      { department: 'RH', decision: 0, comments: null, decidedAt: null },
      { department: 'Seguranca', decision: 0, comments: null, decidedAt: null },
    ],
  },
  {
    id: 103,
    title: 'Limpeza pos-obra - Bloco A',
    activityTypeId: 2,
    location: 'Obra Bloco A - Alphaville',
    headcount: 8,
    urgency: 1,
    status: 6,
    requiredDocumentIds: [1, 2],
    requesterName: 'Marcelo Dias',
    createdAt: '2026-06-14T08:00:00Z',
    approvals: [
      { department: 'RH', decision: 2, comments: null, decidedAt: '2026-06-14T11:00:00Z' },
      { department: 'Seguranca', decision: 2, comments: null, decidedAt: '2026-06-14T15:00:00Z' },
    ],
  },
];

export async function listLaborRequests() {
  try {
    const result = await api.get('/laborRequest/list');

    if(!result){
      throw error;
    } else{
      return {success: true, message:"Sucesso ao buscar solicitações.", body: result.data.body.result}
    }
  } catch (error) {
    console.error("Erro ao buscar solicitações.");
    return {success: false, message:"Erro ao buscar solicitações.", body:{id: null, name: "", risk_level: null, nr_type_id: null, document_type_id: null}}
  }
}

export async function getLaborRequestById(id) {
  try {
    const result = await api.get(`/laborRequest/listById/${id}`);

    if (!result.data.success) {
      return { success: false, body: { message: result.data.body.message } };
    }

    return result.data;
  } catch (error) {
    return { success: false, body: { message: "Erro ao buscar solicitação." } };
  }
}

export async function getActivityTypes(){
  try {
    const result = await api.get('/docRequired/activity_types');

    if(!result){
      throw error;
    } else{
      return {success: true, message:"Sucesso ao buscar tipos de atividades.", body: result.data.body.result}
    }
  } catch (error) {
    console.error("Erro ao buscar tipos de atividades.");
    return {success: true, message:"Erro ao buscar tipos de atividades.", body:{id: null, name: "", risk_level: null, nr_type_id: null, document_type_id: null}}
  }
}

export async function getDocumentsTypes(){
  try {
    const result = await api.get('/docRequired/document_types');

    if(!result){
      throw error;
    } else{
      return {success: true, message:"Sucesso ao buscar tipos de documentos.", body: result.data.body.result}
    }
  } catch (error) {
    console.error("Erro ao buscar tipos de documentos.");
    return {success: true, message:"Erro ao buscar tipos de documentos.", body:{id: null, name: "", risk_level: null, nr_type_id: null, document_type_id: null}}
  }
}

export async function getNrTypes(){
  try {
    const result = await api.get('/docRequired/nr_types');

    if(!result){
      throw error;
    } else{
      return {success: true, message:"Sucesso ao buscar tipos de NRs.", body: result.data.body.result}
    }
  } catch (error) {
    console.error("Erro ao buscar tipos de NRs.");
    return {success: true, message:"Erro ao buscar tipos de NRs.", body:{id: null, name: "", risk_level: null, nr_type_id: null, document_type_id: null}}
  }
}

export async function createLaborRequest(payload) {
  try {
    const result = await api.post('/laborRequest/create', payload)

    if(!result.data.success){
      return {success: false, body: {message: "Erro ao criar solicitação."}}
    }

    return result.data
  } catch (error) {
    return {success: false, body: {message: "Erro ao criar solicitação."}}
  }
}

export function decideApproval(requestId, department, decision, comments) {
  const request = requests.find((item) => item.id === Number(requestId));
  if (!request) return mockDelay(null);

  request.approvals = request.approvals.map((approval) =>
    approval.department === department
      ? { ...approval, decision, comments, decidedAt: new Date().toISOString() }
      : approval,
  );

  const allApproved = request.approvals.every((approval) => approval.decision === 2);
  const anyRejected = request.approvals.some((approval) => approval.decision === 1);
  if (anyRejected) request.status = 2;
  else if (allApproved) request.status = 3;

  return mockDelay(request, 400);
}
