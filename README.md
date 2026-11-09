# DocsUp

Portal de documentação de fornecedores (mão de obra terceirizada). A obra abre a solicitação, a
Segurança do Trabalho aprova e define o contrato e os documentos exigidos, Compras indica o
fornecedor pelo e-mail, o fornecedor declara o que tem e envia a documentação (inicial e mensal),
e o RH / a Segurança validam.

## Fluxo

1. **Solicitação** (qualquer colaborador): atividade, local, urgência e data de início.
2. **Aprovação** (Segurança do Trabalho), em três etapas: **número do contrato** (obrigatório, fica
   fixo), documentos da empresa (ao menos um) e documentos dos colaboradores (NRs e outros; os
   básicos entram sempre). Aprovada → *Aguardando fornecedor*.
3. **Indicar o fornecedor** (Compras): e-mail do fornecedor e prazo dos documentos iniciais (em horas
   ou até uma data). Se o e-mail é de um usuário do portal já confirmado, a solicitação aparece
   direto em "Meus contratos" dele; se não, o link do convite leva ao cadastro. Com o envio de e-mail
   desligado, a tela mostra o link para copiar. → *Pendente de documentação*.
4. **Declaração e termo** (fornecedor): diz se tem cada documento da empresa exigido e quantos
   funcionários têm cada documento de colaborador (NR / outros, no mínimo 1) e assina o termo de
   aceite (quem, data e hora, IP, navegador e o texto do termo ficam gravados). A declaração vira um
   **PDF** com código de verificação, para o fornecedor (em "Sua declaração") e para a contratante (no
   card do fornecedor da solicitação). Faltando documento da empresa, o convite e a
   solicitação ficam **bloqueados** e Compras é avisado (painel e e-mail); Compras reenvia para o
   mesmo e-mail (recomeça do zero) ou troca o fornecedor.
5. **Documentos iniciais** (fornecedor): da empresa e de cada colaborador, dentro do prazo. Depois do
   prazo, só o reenvio do que o RH reprovou ou pediu reenvio. Quando o RH aprova o último documento
   inicial, a solicitação vai sozinha para *Serviço em andamento*.
6. **Documentos trabalhistas mensais** (fornecedor): todo mês, os tipos mensais ativos em Parâmetros
   (da empresa ou de cada colaborador), do mês de início até a conclusão do contrato. Os de um mês são
   enviados no mês seguinte: abrem no dia 1, lembrete no dia 19, prazo até o dia 21 (depois disso o
   envio continua aceito, como atrasado). Os dias ficam em Parâmetros → Trabalhistas mensais.
7. **Validação** (RH / Segurança, em Docs de Fornecedores): status de cada documento, situação de
   cada colaborador, acompanhamento dos mensais por mês, download em ZIP.
8. **Trocar fornecedor** (Compras, com motivo): o atual perde o acesso; os documentos dele ficam guardados.
9. **Concluir contrato** (RH ou Compras, em *Pendente de documentação* ou *Serviço em andamento*):
   → *Concluído*; para a cobrança dos mensais a partir do mês seguinte.

## Notificações (Kafka)

Nenhum e-mail atrasa o sistema: cada ação grava um evento na **outbox** (tabela `event_outbox`), na
mesma transação, e a API responde na hora. O serviço **notifier** (container próprio, mesmo código do
backend, `node notifier.js`) publica os eventos no **Kafka** (container `kafka`, modo KRaft), consome,
monta o e-mail (modelo visual único) e envia, um por destinatário:

- tópicos `notifications.supplier` (fornecedor, na hora) e `notifications.internal` (Compras e RH),
  separados para um resumo grande do RH não atrasar um aviso de fornecedor;
- sem e-mail repetido: cada envio fica em `notification_deliveries` (evento + destinatário);
- SMTP fora do ar: novas tentativas com espera crescente; na 5ª falha, fila de erro
  (`notifications.dlq`), com "Reenviar" em Parâmetros → Notificações;
- Kafka fora do ar: os eventos esperam na outbox e são publicados quando ele voltar;
- agendador: lembrete e vencimento do prazo dos iniciais, calendário dos mensais (dias 1, 19, 21 e
  atrasado no dia seguinte) e o **resumo do RH** a cada X horas (só com novidade).

Avisos ao fornecedor vão para o Responsável e o Operador com e-mail confirmado (sem nenhum, para o
e-mail indicado). Em Parâmetros → Notificações: intervalo do resumo, lembrete do prazo, horário dos
avisos, ligar / desligar cada aviso e os últimos envios. O código de acesso do login sai direto do
backend (código de segurança: não passa por fila).

Para testar com SMTP de verdade sem disparar para fornecedores: `MAIL_REDIRECT_TO=seu@email` manda
tudo para esse endereço.

## Fornecedor

Cadastro em três passos: CNPJ (conferido na Receita), o **Responsável** e o **Operador** (nome e
e-mail, diferentes) e a senha inicial dos dois. Cada um entra com o próprio e-mail, senha e código
de 6 dígitos enviado para o e-mail. No Perfil: nome fantasia (Responsável), dados de cada usuário,
nova senha do Operador (Responsável), cadastro do usuário que faltar (fornecedores antigos) e troca
da própria senha.

## Rodar

```bash
cp .env.example .env   # preencha
docker compose up -d --build
```

O serviço `db-init` aplica o schema e as migrações (`database/migrations`); veja
[database/README.md](database/README.md). Para desenvolvimento local: `npm run dev` em `backend/` e
em `frontend/` (variável `VITE_URL_BACKEND`).

### E-mail

O envio fica desligado enquanto `SMTP_ENABLED` não for `true` no `.env` (só registra no log). Com ele
desligado, o código de acesso do fornecedor só funciona fora de produção (volta na resposta do login).

## Migrações desta versão

| Migração | O que faz |
|---|---|
| 0008 | Número do contrato da solicitação |
| 0009 | Usuários do fornecedor (Responsável e Operador), a partir dos contatos atuais |
| 0010 | Fornecedor indicado por e-mail (no lugar da cotação), com os vínculos e declarações vindos da cotação |
| 0011 | Documentos trabalhistas mensais, dia limite e conclusão do contrato |
| 0012 | E-mail do usuário do fornecedor confirmado (no login) |
| 0013 | Desfaz a confirmação em massa da 0012: só fica confirmado quem veio dos contatos antigos ou já entrou com o código |
| 0014 | Status "Serviço em andamento" (8): solicitações em "Pendente de documentação" (5) com todos os documentos iniciais aprovados passam para 8 |
| 0015 | Notificações por eventos: outbox (event_outbox), registro dos envios (notification_deliveries) e parâmetros (calendário dos mensais 1 / 19 / 21, resumo do RH, lembretes) |
| 0016 | PDF da declaração: código de verificação e o texto do termo assinado |
| 0017 | Correções da revisão: "Serviço em andamento" sem colaborador volta para "Pendente de documentação"; calendário dos mensais coerente (lembrete antes do prazo) |

As tabelas da cotação continuam no banco, sem uso.
