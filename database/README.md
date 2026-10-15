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

Cada script das etapas 3 a 5 roda numa transação. Se der erro, nada daquele script fica gravado e o `db-init` termina com erro; o backend só sobe se o `db-init` terminar com sucesso. As versões aplicadas ficam em `dbo.schema_migrations`.

Se o banco já existir com o schema (ex.: restaurado de outro servidor), a versão `0001_schema_inicial` é só registrada (baseline), sem rodar o script.

## Como criar uma migração

1. Crie `migrations/NNNN_descricao.sql`, com o próximo número livre (o primeiro é `0003`), em minúsculas: `0003_document_category.sql`.
2. Escreva só o DDL/DML. Não use `BEGIN TRAN`/`COMMIT`, porque o `init-db.sh` já envolve o arquivo numa transação e registra a versão.
3. Não altere uma migração que já foi aplicada em algum ambiente. Para corrigir, crie outra.

## Usuários

- `sa`: usado só pelo `db-init`. O backend nunca usa o `sa`.
- Usuário da aplicação (`DB_USERENV`): `db_datareader`, `db_datawriter` e `EXECUTE` no schema `dbo`. Não tem DDL nem `db_owner`, e só pode ler `schema_migrations`.
- Admin inicial do sistema (`USER_ADMIN` / `SENHA_ADMIN`): criado pelo backend na subida, com a senha em bcrypt, só se o e-mail ainda não existir.
