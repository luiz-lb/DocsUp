-- =============================================================================
-- Controle de migrações: cada script de schema/dados aplicado fica registrado
-- aqui, para nunca rodar duas vezes (ver database/README.md).
-- =============================================================================
IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.schema_migrations (
        version    NVARCHAR(200) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
        applied_at DATETIME2(0)  NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT SYSDATETIME()
    );
END
GO
