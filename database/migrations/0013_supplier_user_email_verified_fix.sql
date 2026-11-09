-- =============================================================================
-- 0013: corrige a confirmação de e-mail em massa da 0012
--
-- A 0012 marcou como confirmado o e-mail de TODOS os usuários de fornecedor. A intenção era
-- confirmar só os que vieram dos contatos antigos (migração 0009). Usuários cadastrados
-- depois da 0009 (ou com e-mail trocado no Perfil) que ainda não entraram com o código
-- voltam a ficar sem confirmação: só a confirmação feita pela 0012 é desfeita (data igual
-- à do cadastro); quem já entrou no portal com o código continua confirmado.
--
-- "Veio dos contatos" = o e-mail é de um contato (Legal / Operacional) do mesmo fornecedor.
-- =============================================================================
UPDATE su
SET email_verified_at = NULL
FROM dbo.supplier_users AS su
WHERE su.email_verified_at = su.created_at
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.supplier_contacts AS sc
      WHERE sc.supplier_id = su.supplier_id
        AND sc.contact_type IN (0, 1)
        AND LOWER(LTRIM(RTRIM(sc.email))) = su.email
  );
GO
