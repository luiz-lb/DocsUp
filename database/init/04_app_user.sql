-- =============================================================================
-- Login e usuário da APLICAÇÃO com permissão mínima: leitura, escrita e
-- EXECUTE. Sem DDL e sem db_owner. Roda a cada inicialização (idempotente).
--
-- Variáveis (passadas pelo init-db.sh):
--   $(DB_NAME)      database da aplicação     (validado: letras, números e _)
--   $(APP_USER)     login/usuário             (validado: letras, números e _)
--   $(APP_PASSWORD) senha (aspas simples já duplicadas pelo init-db.sh)
-- =============================================================================
USE [master];
GO

-- Cria o login ou mantém a senha em sincronia com o .env
IF SUSER_ID(N'$(APP_USER)') IS NULL
    CREATE LOGIN [$(APP_USER)]
        WITH PASSWORD = N'$(APP_PASSWORD)',
             DEFAULT_DATABASE = [$(DB_NAME)],
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN [$(APP_USER)] WITH PASSWORD = N'$(APP_PASSWORD)';
GO

ALTER LOGIN [$(APP_USER)] ENABLE;
GO

USE [$(DB_NAME)];
GO

IF USER_ID(N'$(APP_USER)') IS NULL
    CREATE USER [$(APP_USER)] FOR LOGIN [$(APP_USER)] WITH DEFAULT_SCHEMA = [dbo];
GO

-- Religa usuário ao login (ex.: banco restaurado de outro servidor = usuário órfão)
ALTER USER [$(APP_USER)] WITH LOGIN = [$(APP_USER)];
GO

-- Leitura e escrita em todas as tabelas + EXECUTE em procedures/funções do dbo
ALTER ROLE db_datareader ADD MEMBER [$(APP_USER)];
ALTER ROLE db_datawriter ADD MEMBER [$(APP_USER)];
GRANT EXECUTE ON SCHEMA::dbo TO [$(APP_USER)];
GO

-- Defesa: o usuário da aplicação nunca pode ser dono nem ter DDL
IF IS_ROLEMEMBER(N'db_owner', N'$(APP_USER)') = 1
    ALTER ROLE db_owner DROP MEMBER [$(APP_USER)];
IF IS_ROLEMEMBER(N'db_ddladmin', N'$(APP_USER)') = 1
    ALTER ROLE db_ddladmin DROP MEMBER [$(APP_USER)];
IF IS_ROLEMEMBER(N'db_securityadmin', N'$(APP_USER)') = 1
    ALTER ROLE db_securityadmin DROP MEMBER [$(APP_USER)];
GO

-- O controle de migrações é só leitura para a aplicação
DENY INSERT, UPDATE, DELETE ON dbo.schema_migrations TO [$(APP_USER)];
GO
