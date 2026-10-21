-- =============================================================================
-- 0007: método de validação por tipo de documento (Fase 9)
--
-- * document_types.ai_instructions: instrução para a IA (N8N) verificar o documento.
--   Texto puro, até 4000 caracteres, sem senhas, tokens ou dados pessoais: ele é
--   enviado para a IA. Só o Admin vê e edita (Parâmetros).
-- * Todos os tipos passam para validação Manual (2) e sem integração de API: nenhuma
--   validação automática está ligada ainda. O RH valida à mão.
-- =============================================================================

IF COL_LENGTH('dbo.document_types', 'ai_instructions') IS NULL
    ALTER TABLE dbo.document_types ADD ai_instructions NVARCHAR(4000) NULL;
GO

UPDATE dbo.document_types
SET validation_method = 2,
    api_endpoint = NULL;
GO
