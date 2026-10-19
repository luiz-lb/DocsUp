// Formatação compartilhada pelas abas de Parâmetros

/** 'N dia(s)' com o plural certo. */
export function formatDays(days) {
  return `${days} ${Number(days) === 1 ? 'dia' : 'dias'}`;
}

/** Coluna Validade: 'Não', 'Sim' ou 'Sim · prazo padrão N dias'. */
export function describeValidity(documentType) {
  if (!documentType.has_expiration) return 'Não';
  return documentType.validity_days ? `Sim · prazo padrão ${formatDays(documentType.validity_days)}` : 'Sim';
}

/** Corta textos longos para caber numa célula de tabela (o texto inteiro vai no title). */
export function shortText(text, max = 90) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

/** Nome para exibir: nas NRs, o código + título; nos demais, o nome. */
export function documentTypeLabel(documentType) {
  if (documentType.code && documentType.nr_name) return `${documentType.code} - ${documentType.nr_name}`;
  return documentType.name;
}
