-- =============================================================================
-- 0006: situação do colaborador (Fase 8)
--
-- employees.status passa a ser a situação do colaborador, mudada pelo RH e pela
-- Segurança em Docs de Fornecedores (e pela rotina diária das 00:01):
--   0 Pendente de documentos (padrão)   4 Documento a vencer (rotina diária)
--   1 Documentação OK                   5 Desligado
--   2 Integração agendada               6 Retido por pendência da empresa (rotina diária)
--   3 Liberado
-- Antes desta fase nada mudava o status do colaborador (todos ficavam em 0).
--
-- employees.integration_at: data e hora da integração agendada.
-- =============================================================================

IF COL_LENGTH('dbo.employees', 'integration_at') IS NULL
    ALTER TABLE dbo.employees ADD integration_at DATETIME2(0) NULL;
GO

-- Valores antigos fora da nova lista (não deveriam existir) voltam para Pendente
UPDATE dbo.employees SET [status] = 0 WHERE [status] IS NULL OR [status] > 6;
GO

ALTER TABLE dbo.employees ADD CONSTRAINT CK_employees_status CHECK ([status] BETWEEN 0 AND 6);
GO
