-- =============================================================================
-- 0004: catálogo de documentos (Fase 3)
--
-- * document_types.category: 0 Empresa, 1 Colaborador básico, 2 Colaborador NR,
--   3 Colaborador outros. O scope (0 Empresa / 1 Colaborador) continua, derivado
--   da categoria.
-- * document_types.has_expiration: o tipo tem validade? (validity_days vira o
--   prazo padrão, opcional)
-- * document_types.nr_type_id: cada NR do nr_types vira um tipo de documento
--   (categoria 2). O nr_types continua (cotação, aprovação e employee_nrs usam).
-- * activity_type_documents: documentos sugeridos por atividade, no lugar das
--   colunas de texto activity_types.document_type_id / nr_type_id.
-- * Dados: um tipo de documento por NR e "Ficha de EPI" (básico).
-- =============================================================================

-- 1) Colunas novas
ALTER TABLE dbo.document_types ADD
    category       TINYINT NULL,
    has_expiration BIT NOT NULL CONSTRAINT DF_document_types_has_expiration DEFAULT 0,
    nr_type_id     INT NULL;
GO

-- 2) Categoria e validade dos tipos que já existem
UPDATE dbo.document_types SET category = 0 WHERE scope = 0;
UPDATE dbo.document_types SET category = 1 WHERE scope = 1 AND [name] LIKE N'ASO%';
UPDATE dbo.document_types SET category = 3 WHERE scope = 1 AND category IS NULL;

UPDATE dbo.document_types SET has_expiration = 1 WHERE validity_days IS NOT NULL;

-- O certificado genérico de NR é substituído por um tipo por NR (passo 3): fica inativo
-- e os documentos já enviados continuam apontando para ele
UPDATE dbo.document_types SET is_active = 0 WHERE [name] = N'Certificado de Treinamento de NR';
GO

-- 3) Um tipo de documento por NR (categoria 2, com validade), ligado ao nr_types.
-- O método de validação segue o do certificado genérico, para o fluxo não mudar.
INSERT INTO dbo.document_types
    ([name], scope, validation_method, [description], is_active, category, has_expiration, nr_type_id)
SELECT
    LEFT(nr.code + N' - ' + nr.[name], 200),
    1,
    COALESCE((SELECT TOP (1) validation_method FROM dbo.document_types
              WHERE [name] = N'Certificado de Treinamento de NR'), 2),
    nr.[description],
    1,
    2,
    1,
    nr.id
FROM dbo.nr_types AS nr
WHERE NOT EXISTS (SELECT 1 FROM dbo.document_types AS dt WHERE dt.nr_type_id = nr.id);

-- 4) Ficha de EPI (básico do colaborador)
IF NOT EXISTS (SELECT 1 FROM dbo.document_types WHERE [name] = N'Ficha de EPI')
    INSERT INTO dbo.document_types
        ([name], scope, validation_method, [description], is_active, category, has_expiration)
    VALUES
        (N'Ficha de EPI', 1, 2,
         N'Registro da entrega dos Equipamentos de Proteção Individual ao colaborador.',
         1, 1, 0);
GO

-- 5) Regras da tabela
ALTER TABLE dbo.document_types ALTER COLUMN category TINYINT NOT NULL;
GO

ALTER TABLE dbo.document_types ADD
    CONSTRAINT CK_document_types_category CHECK (category BETWEEN 0 AND 3),
    -- escopo derivado da categoria: Empresa = 0; colaborador (básico, NR, outros) = 1
    CONSTRAINT CK_document_types_scope_category
        CHECK ((category = 0 AND scope = 0) OR (category IN (1, 2, 3) AND scope = 1)),
    -- só NR tem vínculo com nr_types, e toda NR tem
    CONSTRAINT CK_document_types_nr
        CHECK ((category = 2 AND nr_type_id IS NOT NULL) OR (category <> 2 AND nr_type_id IS NULL)),
    CONSTRAINT FK_document_types_nr_type FOREIGN KEY (nr_type_id) REFERENCES dbo.nr_types (id);
GO

-- Cada NR tem um único tipo de documento
CREATE UNIQUE NONCLUSTERED INDEX UX_document_types_nr_type
    ON dbo.document_types (nr_type_id)
    WHERE nr_type_id IS NOT NULL;
GO

-- 6) Documentos sugeridos por atividade
CREATE TABLE dbo.activity_type_documents (
    activity_type_id INT NOT NULL,
    document_type_id INT NOT NULL,
    CONSTRAINT PK_activity_type_documents PRIMARY KEY (activity_type_id, document_type_id),
    CONSTRAINT FK_activity_type_documents_activity
        FOREIGN KEY (activity_type_id) REFERENCES dbo.activity_types (id),
    CONSTRAINT FK_activity_type_documents_document
        FOREIGN KEY (document_type_id) REFERENCES dbo.document_types (id)
);
GO

-- Empresa e outros: os ids estavam em activity_types.document_type_id ("1,2,3").
-- Básicos ficam de fora: são sempre exigidos, não são sugestão.
INSERT INTO dbo.activity_type_documents (activity_type_id, document_type_id)
SELECT DISTINCT a.id, dt.id
FROM dbo.activity_types AS a
CROSS APPLY STRING_SPLIT(a.document_type_id, ',') AS s
INNER JOIN dbo.document_types AS dt ON dt.id = TRY_CAST(TRIM(s.value) AS INT)
WHERE dt.category <> 1;

-- NRs: activity_types.nr_type_id tinha ids de nr_types; vira o tipo de documento da NR
INSERT INTO dbo.activity_type_documents (activity_type_id, document_type_id)
SELECT DISTINCT a.id, dt.id
FROM dbo.activity_types AS a
CROSS APPLY STRING_SPLIT(a.nr_type_id, ',') AS s
INNER JOIN dbo.document_types AS dt ON dt.nr_type_id = TRY_CAST(TRIM(s.value) AS INT)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.activity_type_documents AS x
    WHERE x.activity_type_id = a.id AND x.document_type_id = dt.id
);

-- As colunas de texto deixam de ser usadas: passam a aceitar NULL (atividades novas
-- ficam sem elas). Podem ser excluídas numa migração futura.
ALTER TABLE dbo.activity_types ALTER COLUMN nr_type_id VARCHAR(100) NULL;
ALTER TABLE dbo.activity_types ALTER COLUMN document_type_id VARCHAR(100) NULL;
GO
