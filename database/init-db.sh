#!/usr/bin/env bash
# =============================================================================
# DocsUp — inicialização do banco (serviço db-init do docker-compose)
#
# Idempotente: roda a cada `docker compose up` sem quebrar nem duplicar nada.
#   1. cria o database, se não existir                     (init/00_create_database.sql)
#   2. cria dbo.schema_migrations, se não existir          (init/01_schema_migrations.sql)
#   3. aplica, uma única vez cada e dentro de transação:
#        0001_schema_inicial  -> init/02_schema.sql
#        0002_seed_inicial    -> init/03_seed.sql
#        migrations/NNNN_*.sql, em ordem de nome
#   4. cria/atualiza o login da aplicação com permissão mínima (init/04_app_user.sql)
# =============================================================================
# -E: o trap de ERR também vale dentro das funções (sql, apply...)
set -Eeuo pipefail

SCRIPTS_DIR="${SCRIPTS_DIR:-/database}"
DB_HOST="${DB_HOST:-db}"

log()  { echo "[db-init] $*"; }
fail() { echo "[db-init] ERRO: $*" >&2; exit 1; }
trap 'echo "[db-init] Falhou (linha $LINENO). Veja o erro acima. Se foi numa migração, ela foi desfeita por inteiro." >&2' ERR

[ -n "${MSSQL_SA_PASSWORD:-}" ] || fail "MSSQL_SA_PASSWORD não definido."
[ -n "${DB_DATABASE:-}" ]       || fail "DB_DATABASE não definido."
[ -n "${DB_USERENV:-}" ]        || fail "DB_USERENV não definido."
[ -n "${DB_PASSWORD:-}" ]       || fail "DB_PASSWORD não definido."

# Esses nomes entram como identificadores no SQL: só letras, números e _
IDENT_RE='^[A-Za-z_][A-Za-z0-9_]{0,127}$'
[[ "$DB_DATABASE" =~ $IDENT_RE ]] || fail "DB_DATABASE inválido ('$DB_DATABASE'): use só letras, números e _."
[[ "$DB_USERENV"  =~ $IDENT_RE ]] || fail "DB_USERENV inválido ('$DB_USERENV'): use só letras, números e _."
case "${DB_USERENV,,}" in
  sa|dbo|guest|sys|public|information_schema) fail "DB_USERENV não pode ser '$DB_USERENV'." ;;
esac
case "${DB_DATABASE,,}" in
  master|model|msdb|tempdb) fail "DB_DATABASE não pode ser um banco de sistema." ;;
esac

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
[ -x "$SQLCMD" ] || SQLCMD=/opt/mssql-tools/bin/sqlcmd
[ -x "$SQLCMD" ] || fail "sqlcmd não encontrado na imagem."

# Senha do sa por variável de ambiente (não aparece na linha de comando)
export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"
# Os .sql estão em UTF-8 (acentos)
export LANG=C.UTF-8 LC_ALL=C.UTF-8

# sqlcmd como sa: -b aborta no 1º erro, -I liga QUOTED_IDENTIFIER, -C aceita o certificado autoassinado
sql() { "$SQLCMD" -S "$DB_HOST" -U sa -C -b -I "$@"; }

# Valor escalar de uma consulta no database da aplicação (sem cabeçalho nem espaços)
sql_value() { sql -d "$DB_DATABASE" -h -1 -W -Q "SET NOCOUNT ON; $1" | tr -d '[:space:]'; }

is_applied() {
  [ "$(sql_value "SELECT COUNT(*) FROM dbo.schema_migrations WHERE version = N'$1'")" = "1" ]
}

# Aplica um script numa transação e registra a versão. Qualquer erro encerra o
# sqlcmd, a conexão cai e o SQL Server desfaz a transação inteira.
apply() {
  local version="$1" file="$2" wrapper
  wrapper="$(mktemp)"
  cat > "$wrapper" <<EOF
:on error exit
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO
:r $file
GO
INSERT INTO dbo.schema_migrations (version) VALUES (N'$version');
COMMIT TRANSACTION;
GO
EOF
  sql -d "$DB_DATABASE" -i "$wrapper"
  rm -f "$wrapper"
}

log "Aguardando o SQL Server em $DB_HOST..."
for i in $(seq 1 60); do
  if sql -d master -Q "SET NOCOUNT ON; SELECT 1" -o /dev/null 2>/dev/null; then break; fi
  [ "$i" -lt 60 ] || fail "SQL Server não respondeu em 2 minutos."
  sleep 2
done

log "1/4 Database [$DB_DATABASE]"
sql -d master -v DB_NAME="$DB_DATABASE" -i "$SCRIPTS_DIR/init/00_create_database.sql"

log "2/4 Controle de migrações"
sql -d "$DB_DATABASE" -i "$SCRIPTS_DIR/init/01_schema_migrations.sql"

log "3/4 Schema, dados iniciais e migrações"
if ! is_applied "0001_schema_inicial"; then
  if [ "$(sql_value "SELECT CASE WHEN OBJECT_ID(N'dbo.users', N'U') IS NULL THEN 0 ELSE 1 END")" = "1" ]; then
    # Banco restaurado de outro ambiente: o schema já existe, só registra
    log "    schema já existente: 0001_schema_inicial registrado como baseline"
    sql -d "$DB_DATABASE" -Q "INSERT INTO dbo.schema_migrations (version) VALUES (N'0001_schema_inicial');"
  else
    log "    aplicando 0001_schema_inicial"
    apply "0001_schema_inicial" "$SCRIPTS_DIR/init/02_schema.sql"
  fi
fi

if ! is_applied "0002_seed_inicial"; then
  log "    aplicando 0002_seed_inicial"
  apply "0002_seed_inicial" "$SCRIPTS_DIR/init/03_seed.sql"
fi

shopt -s nullglob
for file in "$SCRIPTS_DIR"/migrations/*.sql; do
  name="$(basename "$file" .sql)"
  [[ "$name" =~ ^[0-9]{4}_[a-z0-9_]+$ ]] \
    || fail "Nome de migração inválido: $(basename "$file") (use NNNN_descricao.sql, em minúsculas)."
  if ! is_applied "$name"; then
    log "    aplicando $name"
    apply "$name" "$file"
  fi
done

log "4/4 Usuário da aplicação [$DB_USERENV]: leitura, escrita e EXECUTE"
# Senha só no ambiente deste sqlcmd, com aspas simples duplicadas para o literal SQL
APP_PASSWORD="${DB_PASSWORD//\'/\'\'}" \
  sql -d master -v DB_NAME="$DB_DATABASE" -v APP_USER="$DB_USERENV" -i "$SCRIPTS_DIR/init/04_app_user.sql"

log "Banco pronto."
