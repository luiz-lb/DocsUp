-- =============================================================================
-- 0016: PDF da declaração do fornecedor
--
-- A assinatura já guarda quem assinou (declared_by), a data e a hora (declared_at), o IP
-- (acceptance_ip) e o navegador (acceptance_user_agent). Passam a ser guardados também:
--   * declaration_code: código de verificação impresso no PDF (XXXX-XXXX-XXXX), o mesmo que
--     aparece no sistema; dá para conferir se um PDF é desta declaração;
--   * term_version / term_text: a versão e o texto do termo de aceite que foi assinado (o PDF
--     mostra exatamente o texto aceito, mesmo que o termo mude depois).
-- Declarações já assinadas ganham um código; o texto do termo fica vazio (o PDF avisa que
-- foram assinadas antes de o texto ser guardado e mostra o texto atual).
-- =============================================================================
ALTER TABLE dbo.labor_request_suppliers ADD
    declaration_code VARCHAR(20) NULL,
    term_version     VARCHAR(20) NULL,
    term_text        NVARCHAR(MAX) NULL;
GO

UPDATE dbo.labor_request_suppliers
SET declaration_code = STUFF(STUFF(UPPER(LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 12)), 9, 0, '-'), 5, 0, '-')
WHERE declared_at IS NOT NULL AND declaration_code IS NULL;
GO

CREATE UNIQUE INDEX UX_lr_suppliers_declaration_code
    ON dbo.labor_request_suppliers (declaration_code)
    WHERE declaration_code IS NOT NULL;
GO
