-- =============================================================================
-- Cria o database da aplicação, se ainda não existir. Executado no master.
-- $(DB_NAME) = DB_DATABASE do .env (validado no init-db.sh: só letras, números e _).
-- =============================================================================
IF DB_ID(N'$(DB_NAME)') IS NULL
BEGIN
    CREATE DATABASE [$(DB_NAME)];
END
GO
