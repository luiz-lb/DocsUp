# Banco de dados (SQL Server)

O serviço `db-init` do `docker-compose.yml` roda o [init-db.sh](init-db.sh) a cada `docker compose up`. O script é idempotente: rodar de novo não quebra nem duplica nada.

| Ordem | Arquivo | Quando roda |
|---|---|---|
| 1 | `init/00_create_database.sql` | sempre (cria o database se não existir) |
| 2 | `init/01_schema_migrations.sql` | sempre (cria a tabela de controle se não existir) |
| 3 | `init/02_schema.sql` | uma vez, como versão `0001_schema_inicial` |
| 4 | `init/03_seed.sql` | uma vez, como versão `0002_seed_inicial` (só em tabelas vazias) |
| 5 | `migrations/NNNN_*.sql` | uma vez cada, em ordem de nome |
| 6 | `init/04_app_user.sql` | sempre (login da aplicação com permissão mínima) |

Cada script das etapas 3 a 5 roda numa transação. Se der erro, a transação é desfeita, a versão não é registrada e o `db-init` termina com erro; o backend só sobe se o `db-init` terminar com sucesso. A exceção é um script que dá `COMMIT` por conta própria (proibido, ver abaixo): o que ele gravou até ali fica no banco. As versões aplicadas ficam em `dbo.schema_migrations`.

Se o banco já existir com o schema (ex.: restaurado de outro servidor), a versão `0001_schema_inicial` é só registrada (baseline), sem rodar o script.

## Como criar uma migração

1. Crie `migrations/NNNN_descricao.sql`, com o próximo número livre (o primeiro é `0003`), em minúsculas: `0003_document_category.sql`.
2. Escreva só o DDL/DML. Não use `BEGIN TRAN`, `COMMIT`, `ROLLBACK` nem `TRY/CATCH` que engula erro: o `init-db.sh` já envolve o arquivo numa transação e registra a versão. Se o script mexer na transação, o `init-db.sh` acusa erro e não registra nada.
3. Não altere uma migração que já foi aplicada em algum ambiente. Para corrigir, crie outra.

## Trocar a senha do sa

A imagem do SQL Server só aplica `MSSQL_SA_PASSWORD` na 1ª subida, quando cria o `master` num volume vazio. Depois disso a senha fica gravada no volume, e mudar o `.env` não a altera. Se o `.env` ficar diferente do servidor, o healthcheck falha, o `db` fica unhealthy e o `db-init` e o backend não sobem.

1. Troque a senha no servidor. O `sqlcmd` pede a senha atual do `sa`, e a nova não fica no histórico do terminal:
   ```
   docker compose exec db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C
   1> ALTER LOGIN sa WITH PASSWORD = N'NovaSenha';
   2> GO
   3> EXIT
   ```
2. Atualize `MSSQL_SA_PASSWORD` no `.env`.
3. Rode `docker compose up -d` (recria `db` e `db-init` com a senha nova).

Se o `.env` já foi trocado e o `db` ficou unhealthy, o SQL Server continua no ar: faça o passo 1 com a senha antiga e rode o `up` de novo. Não use `docker compose down -v` para "zerar": ele apaga o volume do banco e também o volume de `uploads`.

O usuário da aplicação (`DB_PASSWORD`) é diferente: o `db-init` sincroniza a senha dele com o `.env` a cada subida.

## Trazer dados de outro banco

Um backup (`.bak`) só restaura numa versão igual ou mais nova do SQL Server. O banco de desenvolvimento atual é SQL Server 2025, e o container é 2022, então o backup de lá não restaura aqui. Para levar os dados:

1. Suba **só o banco**, para o `db-init` criar o schema: `docker compose up -d db-init` (o `db` sobe junto). Espere `docker compose logs db-init` terminar em `Banco pronto.`. Não suba o backend antes de importar: ele cria o Admin de `USER_ADMIN` com `id` 1, que conflita com o usuário 1 do banco de origem.
2. No SSMS, no banco de origem: Tarefas > Gerar Scripts > Avançado, com "Tipos de dados para script" = **Somente dados** e "Script para a versão do servidor" = **SQL Server 2022**.
3. No script gerado, apague a linha `USE [...]` do topo, se o nome do banco de origem for diferente de `DB_DATABASE`.
4. Conectado no container como `sa` (`127.0.0.1,14330`), apague os catálogos que o seed criou, porque o script traz os da origem com os mesmos ids:
   ```sql
   DELETE FROM dbo.activity_types; DELETE FROM dbo.document_types;
   DELETE FROM dbo.nr_types;       DELETE FROM dbo.regions;
   ```
5. Rode o script gerado no banco `DB_DATABASE`.
6. Os prazos de rodada (`quotation_rounds.deadline`) gravados pelo backend antes da Fase 2.1 estão em UTC. Desde a 2.1 o backend grava hora local, então essas linhas aparecem 3h mais tarde. Corrija só as antigas: `UPDATE dbo.quotation_rounds SET deadline = DATEADD(HOUR, -3, deadline);` (rode uma vez, logo após importar).
7. Suba o resto: `docker compose up -d`.

## Usuários

- `sa`: usado só pelo `db-init`. O backend nunca usa o `sa`.
- Usuário da aplicação (`DB_USERENV`): `db_datareader`, `db_datawriter` e `EXECUTE` no schema `dbo`. Não tem DDL nem `db_owner`, e só pode ler `schema_migrations`.
- Admin inicial do sistema (`USER_ADMIN` / `SENHA_ADMIN`): criado pelo backend na subida, só se o e-mail ainda não existir. `SENHA_ADMIN` aceita a senha em texto ou um hash bcrypt (entre aspas simples no `.env`).
