-- =============================================================================
-- 0008: número do contrato da solicitação
--
-- labor_requests.contract_number: informado pela Segurança do Trabalho na aprovação
-- (obrigatório para aprovar). Texto de até 50 caracteres, porque o formato do número
-- ainda não está definido. Fica fixo depois da aprovação: não existe tela para alterar,
-- a correção é feita direto no banco.
-- Solicitações aprovadas antes desta migração ficam sem número (NULL).
-- =============================================================================
IF COL_LENGTH(N'dbo.labor_requests', N'contract_number') IS NULL
    ALTER TABLE dbo.labor_requests ADD contract_number NVARCHAR(50) NULL;
GO

-- Filtro por contrato (Docs de Fornecedores, Colaboradores, lista de solicitações)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_labor_requests_contract_number')
    CREATE NONCLUSTERED INDEX IX_labor_requests_contract_number
        ON dbo.labor_requests (contract_number)
        WHERE contract_number IS NOT NULL;
GO
