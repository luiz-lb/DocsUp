-- =============================================================================
-- 0011: documentos trabalhistas mensais e conclusão do contrato
--
-- * document_types.category 4 = Trabalhista mensal (espelho de ponto, folha, FGTS...).
--   Pode ser da empresa (scope 0) ou de cada colaborador (scope 1). Os tipos mensais
--   ativos valem para todos os contratos (não há escolha por solicitação).
-- * documents.reference_month: mês de referência (competência) do documento mensal,
--   sempre no dia 1. NULL nos documentos iniciais. A "vaga" do documento mensal inclui
--   o mês: cada competência tem o seu histórico de entregas.
-- * app_settings: parâmetros do sistema. monthly_documents_due_day = dia limite do mês
--   seguinte para enviar os documentos de uma competência (padrão 10).
-- * labor_requests.concluded_at / concluded_by: contrato concluído (RH ou Compras).
--   Depois disso não há novas competências a cobrar.
-- * Dados: alguns tipos mensais comuns, INATIVOS (o Admin ativa os que valem).
-- =============================================================================

-- 1) Categoria 4 e escopo livre (empresa ou colaborador) para ela
ALTER TABLE dbo.document_types DROP CONSTRAINT CK_document_types_category;
ALTER TABLE dbo.document_types DROP CONSTRAINT CK_document_types_scope_category;
GO
ALTER TABLE dbo.document_types ADD
    CONSTRAINT CK_document_types_category CHECK (category BETWEEN 0 AND 4),
    CONSTRAINT CK_document_types_scope_category CHECK (
        (category = 0 AND scope = 0)
        OR (category IN (1, 2, 3) AND scope = 1)
        OR (category = 4 AND scope IN (0, 1))
    );
GO

-- 2) Competência do documento mensal (dia 1 do mês)
IF COL_LENGTH(N'dbo.documents', N'reference_month') IS NULL
    ALTER TABLE dbo.documents ADD reference_month DATE NULL;
GO
ALTER TABLE dbo.documents ADD CONSTRAINT CK_documents_reference_month
    CHECK (reference_month IS NULL OR DAY(reference_month) = 1);
GO
CREATE NONCLUSTERED INDEX IX_documents_monthly
    ON dbo.documents (supplier_id, labor_request_id, reference_month)
    INCLUDE (document_type_id, employee_id, is_current, [status])
    WHERE reference_month IS NOT NULL;
GO

-- 3) Parâmetros do sistema
CREATE TABLE dbo.app_settings (
    setting_key   VARCHAR(100)  NOT NULL,
    setting_value NVARCHAR(500) NOT NULL,
    updated_at    DATETIME2(0)  NOT NULL CONSTRAINT DF_app_settings_updated_at DEFAULT GETDATE(),
    updated_by    INT NULL,
    CONSTRAINT PK_app_settings PRIMARY KEY (setting_key),
    CONSTRAINT FK_app_settings_user FOREIGN KEY (updated_by) REFERENCES dbo.users (id)
);
GO
INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('monthly_documents_due_day', N'10');
GO

-- 4) Contrato concluído
IF COL_LENGTH(N'dbo.labor_requests', N'concluded_at') IS NULL
    ALTER TABLE dbo.labor_requests ADD
        concluded_at DATETIME2(0) NULL,
        concluded_by INT NULL CONSTRAINT FK_labor_requests_concluded_by REFERENCES dbo.users (id);
GO

-- 5) Tipos mensais sugeridos (inativos: o Admin ativa em Parâmetros)
INSERT INTO dbo.document_types ([name], scope, validation_method, [description], is_active, category, has_expiration)
SELECT v.[name], v.scope, 2, v.[description], 0, 4, 0
FROM (VALUES
    (N'Espelho de ponto', 1, N'Registro mensal de jornada do colaborador.'),
    (N'Recibo de pagamento (holerite)', 1, N'Recibo de salário do mês, assinado pelo colaborador.'),
    (N'Folha de pagamento', 0, N'Folha de pagamento do mês dos colaboradores alocados no contrato.'),
    (N'Comprovante de recolhimento do FGTS', 0, N'Guia e comprovante de pagamento do FGTS do mês.'),
    (N'Comprovante de recolhimento do INSS', 0, N'Guia (DCTFWeb / GPS) e comprovante de pagamento do INSS do mês.')
) AS v([name], scope, [description])
WHERE NOT EXISTS (SELECT 1 FROM dbo.document_types AS dt WHERE dt.[name] = v.[name]);
GO
