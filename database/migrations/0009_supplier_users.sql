-- =============================================================================
-- 0009: usuários do fornecedor (cadastro simplificado)
--
-- Cada fornecedor tem dois usuários que entram no portal, cada um com o próprio
-- e-mail e senha: o Responsável (dono, role 0) e o Operador (role 1). O login passa
-- a ser pelo e-mail do usuário (o CNPJ deixa de ser login).
--
-- * supplier_users: e-mail único no sistema todo (é o login), senha (bcrypt) por
--   usuário e sessions_valid_after (sessões abertas antes disso caem, ex.: troca de senha).
-- * suppliers.password_hash passa a aceitar NULL: a senha agora fica no usuário.
--   Os fornecedores novos gravam NULL; a coluna fica só para histórico.
-- * Fornecedores existentes: o contato Legal (0) vira o Responsável e o Operacional (1)
--   vira o Operador, com a senha atual do fornecedor. Como o e-mail é único:
--     - mesmo e-mail nos dois contatos do MESMO fornecedor: fica só o Responsável;
--     - mesmo e-mail em fornecedores DIFERENTES: fica o contato Operacional (era ele que
--       entrava no portal pelo e-mail) e, entre iguais, o fornecedor mais antigo.
--   Contatos sem e-mail não viram usuário. Quem ficar sem um dos dois usuários cadastra o
--   que falta no Perfil do portal.
--
-- Deixam de ser usados (as tabelas ficam, com os dados): supplier_contacts,
-- supplier_regions e supplier_categories, além de suppliers.employee_count, city e state.
-- =============================================================================
CREATE TABLE dbo.supplier_users (
    id                   INT IDENTITY(1,1) NOT NULL,
    uid                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_supplier_users_uid DEFAULT NEWID(),
    supplier_id          INT NOT NULL,
    [role]               TINYINT NOT NULL,          -- 0 Responsável (dono), 1 Operador
    [name]               NVARCHAR(200) NOT NULL,
    email                NVARCHAR(200) NOT NULL,     -- sempre em minúsculas
    password_hash        VARCHAR(255) NOT NULL,
    is_active            BIT NOT NULL CONSTRAINT DF_supplier_users_is_active DEFAULT 1,
    sessions_valid_after DATETIME2(0) NULL,
    created_at           DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_users_created_at DEFAULT GETDATE(),
    updated_at           DATETIME2(0) NULL,
    CONSTRAINT PK_supplier_users PRIMARY KEY (id),
    CONSTRAINT UQ_supplier_users_uid UNIQUE (uid),
    -- um Responsável e um Operador por fornecedor
    CONSTRAINT UQ_supplier_users_supplier_role UNIQUE (supplier_id, [role]),
    CONSTRAINT CK_supplier_users_role CHECK ([role] IN (0, 1)),
    CONSTRAINT FK_supplier_users_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers (id)
);
GO

-- O e-mail é o login: único no sistema todo
CREATE UNIQUE NONCLUSTERED INDEX UX_supplier_users_email ON dbo.supplier_users (email);
GO

ALTER TABLE dbo.suppliers ALTER COLUMN password_hash VARCHAR(500) NULL;
GO

-- Fornecedores existentes: Legal → Responsável, Operacional → Operador (senha atual)
;WITH contacts AS (
    SELECT
        sc.supplier_id,
        CAST(sc.contact_type AS TINYINT)               AS [role],
        NULLIF(LTRIM(RTRIM(sc.[name])), N'')           AS [name],
        LOWER(LTRIM(RTRIM(sc.email)))                  AS email,
        s.password_hash,
        ROW_NUMBER() OVER (
            PARTITION BY sc.supplier_id, sc.contact_type
            ORDER BY sc.is_primary DESC, sc.id
        ) AS rn_role
    FROM dbo.supplier_contacts AS sc
    INNER JOIN dbo.suppliers AS s ON s.id = sc.supplier_id
    WHERE sc.contact_type IN (0, 1)
      AND NULLIF(LTRIM(RTRIM(sc.email)), N'') IS NOT NULL
      AND s.password_hash IS NOT NULL
),
one_per_role AS (
    SELECT c.*
    FROM contacts AS c
    WHERE c.rn_role = 1
      -- Operacional com o mesmo e-mail do Legal do mesmo fornecedor: fica só o Responsável
      AND NOT (
          c.[role] = 1
          AND EXISTS (
              SELECT 1 FROM contacts AS legal
              WHERE legal.supplier_id = c.supplier_id
                AND legal.[role] = 0
                AND legal.rn_role = 1
                AND legal.email = c.email
          )
      )
),
unique_email AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY email
               ORDER BY CASE WHEN [role] = 1 THEN 0 ELSE 1 END, supplier_id
           ) AS rn_email
    FROM one_per_role
)
INSERT INTO dbo.supplier_users (supplier_id, [role], [name], email, password_hash)
SELECT supplier_id, [role], LEFT(COALESCE([name], email), 200), LEFT(email, 200), password_hash
FROM unique_email
WHERE rn_email = 1;
GO
