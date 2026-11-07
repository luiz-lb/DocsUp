-- =============================================================================
-- 0012: e-mail do usuário do fornecedor confirmado
--
-- supplier_users.email_verified_at: quando o e-mail foi confirmado, ou seja, quando o usuário
-- entrou no portal com o código enviado para esse e-mail. Cadastro novo, e-mail trocado no
-- Perfil e usuário cadastrado pelo colega ficam sem confirmação até o primeiro login.
--
-- Só e-mail confirmado puxa convite na hora: Compras indica um e-mail e, se ele é de um
-- usuário confirmado, a solicitação vai direto para aquela empresa. E-mail ainda não
-- confirmado fica esperando quem entrar com ele (evita que alguém digite o e-mail de outra
-- empresa no próprio cadastro e receba o convite dela).
--
-- Os usuários que já existem (vindos dos contatos, migração 0009) contam como confirmados.
-- =============================================================================
IF COL_LENGTH(N'dbo.supplier_users', N'email_verified_at') IS NULL
    ALTER TABLE dbo.supplier_users ADD email_verified_at DATETIME2(0) NULL;
GO
UPDATE dbo.supplier_users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
GO
