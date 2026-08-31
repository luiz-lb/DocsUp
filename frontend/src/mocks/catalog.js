// Dados de referencia compartilhados entre features (equivalente as tabelas
// "de catalogo" do schema: activity_types, document_types, nr_types,
// service_categories, regions). Hoje e' um mock local; quando plugar o
// backend, isso vira uma chamada unica de reference-data cacheada.

export const NR_TYPES = [
  { id: 10, code: 'NR-10', name: 'Seguranca em Instalacoes Eletricas' },
  { id: 12, code: 'NR-12', name: 'Seguranca no Trabalho em Maquinas e Equipamentos' },
  { id: 18, code: 'NR-18', name: 'Condicoes de Seguranca na Industria da Construcao' },
  { id: 20, code: 'NR-20', name: 'Seguranca com Inflamaveis e Combustiveis' },
  { id: 35, code: 'NR-35', name: 'Trabalho em Altura' },
];

export const DOCUMENT_TYPES = [
  { id: 1, name: 'Contrato Social', scope: 0, validationMethod: 2 },
  { id: 2, name: 'CND Federal', scope: 0, validationMethod: 0 },
  { id: 3, name: 'Regularidade FGTS (CRF)', scope: 0, validationMethod: 0 },
  { id: 4, name: 'PGR - Programa de Gerenciamento de Riscos', scope: 0, validationMethod: 1 },
  { id: 5, name: 'APR - Analise Preliminar de Risco', scope: 0, validationMethod: 1 },
  { id: 6, name: 'CIPA - Ata de Constituicao', scope: 0, validationMethod: 2 },
  { id: 7, name: 'ASO - Atestado de Saude Ocupacional', scope: 1, validationMethod: 2 },
  { id: 8, name: 'Certificado de Treinamento de NR', scope: 1, validationMethod: 1 },
];

export const ACTIVITY_TYPES = [
  {
    id: 1,
    name: 'Instalacao Eletrica',
    riskLevel: 2,
    requiredNrIds: [10, 12],
    requiredDocumentIds: [1, 2, 3, 5],
  },
  {
    id: 2,
    name: 'Limpeza e Conservacao',
    riskLevel: 0,
    requiredNrIds: [],
    requiredDocumentIds: [1, 2],
  },
  {
    id: 3,
    name: 'Soldagem e Corte a Quente',
    riskLevel: 3,
    requiredNrIds: [12, 18, 20],
    requiredDocumentIds: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 4,
    name: 'Trabalho em Altura',
    riskLevel: 2,
    requiredNrIds: [35],
    requiredDocumentIds: [1, 2, 3, 5],
  },
];

export const SERVICE_CATEGORIES = [
  { id: 1, name: 'Eletrica' },
  { id: 2, name: 'Construcao Civil' },
  { id: 3, name: 'Limpeza' },
  { id: 4, name: 'Solda e Caldeiraria' },
  { id: 5, name: 'Locacao de Equipamentos' },
];

export const REGIONS = [
  { id: 1, city: 'Sao Paulo', state: 'SP' },
  { id: 2, city: 'Campinas', state: 'SP' },
  { id: 3, city: 'Rio de Janeiro', state: 'RJ' },
  { id: 4, city: 'Belo Horizonte', state: 'MG' },
  { id: 5, city: 'Curitiba', state: 'PR' },
];

export function findActivityType(id) {
  return ACTIVITY_TYPES.find((activity) => activity.id === id);
}

export function findDocumentType(id) {
  return DOCUMENT_TYPES.find((doc) => doc.id === id);
}
