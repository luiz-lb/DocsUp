-- =============================================================================
-- 0003: users.sessions_valid_after
--
-- Tokens (JWT) emitidos antes deste instante são recusados pelo backend.
-- Gravado ao redefinir a senha, para encerrar as sessões abertas do usuário.
-- NULL = sem restrição (nenhum dado existente muda).
-- =============================================================================
IF COL_LENGTH(N'dbo.users', N'sessions_valid_after') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD sessions_valid_after DATETIME2(0) NULL;
END
GO
