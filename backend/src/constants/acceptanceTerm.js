/**
 * Termo de aceite digital da declaração do fornecedor. A tela de assinatura mostra este texto
 * (vem da API) e a assinatura guarda a versão e o texto aceitos (o PDF imprime o que foi
 * aceito). Mudou o texto? Suba a versão.
 */
export const ACCEPTANCE_TERM = Object.freeze({
    version: '2026-11',
    intro: 'Ao assinar, ficam registrados nesta declaração o nome de quem assinou, a data e a hora, o IP e o navegador, com validade de aceite digital.',
    statements: Object.freeze([
        'Declaro que as informações sobre os documentos da empresa e a quantidade de funcionários com cada documento são verdadeiras.',
        'Estou ciente de que a omissão de documentação obrigatória pode causar atraso no pagamento e até a mudança ou o cancelamento do contrato.',
    ]),
});

/** Texto guardado na assinatura (uma afirmação por linha, depois da introdução). */
export function acceptanceTermText(term = ACCEPTANCE_TERM) {
    return [term.intro, ...term.statements].join('\n');
}
