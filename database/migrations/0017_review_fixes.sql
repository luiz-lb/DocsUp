-- =============================================================================
-- 0017: correções da revisão
--
-- 1) "Serviço em andamento" (8) exige pelo menos um colaborador (não desligado) quando a
--    solicitação tem documentos básicos exigidos. A 0014 (e a regra até aqui) levava para 8
--    um contrato só com os documentos da empresa aprovados e nenhum colaborador cadastrado.
--    Esses voltam para "Pendente de documentação" (5).
-- 2) Calendário dos documentos mensais coerente: abertura < lembrete < último dia. A 0015
--    criou o lembrete no dia 19, mas só mudava o prazo do padrão 10 para 21: quem tinha outro
--    prazo (ex.: 15) ficou com o lembrete depois do prazo. Fica o prazo; o lembrete passa a ser
--    2 dias antes dele.
-- =============================================================================
UPDATE lr
SET [status] = 5,
    updated_at = GETDATE()
FROM dbo.labor_requests AS lr
INNER JOIN dbo.labor_request_suppliers AS l
    ON l.labor_request_id = lr.id AND l.[status] = 1
WHERE lr.[status] = 8
  AND EXISTS (
      SELECT 1
      FROM dbo.labor_request_documents AS lrd
      INNER JOIN dbo.document_types AS dt ON dt.id = lrd.document_type_id
      WHERE lrd.labor_request_id = lr.id AND dt.category = 1 AND dt.is_active = 1
  )
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.employees AS e
      WHERE e.supplier_id = l.supplier_id
        AND e.labor_request_id = lr.id
        AND ISNULL(e.[status], 0) <> 5
  );
GO

DECLARE @open INT, @reminder INT, @due INT;
SELECT @open = TRY_CAST(setting_value AS INT) FROM dbo.app_settings WHERE setting_key = 'monthly_documents_open_day';
SELECT @reminder = TRY_CAST(setting_value AS INT) FROM dbo.app_settings WHERE setting_key = 'monthly_documents_reminder_day';
SELECT @due = TRY_CAST(setting_value AS INT) FROM dbo.app_settings WHERE setting_key = 'monthly_documents_due_day';

SET @due = CASE WHEN @due BETWEEN 3 AND 28 THEN @due ELSE 21 END;
SET @open = CASE WHEN @open BETWEEN 1 AND 28 AND @open < @due - 1 THEN @open ELSE 1 END;
IF @reminder IS NULL OR NOT (@reminder > @open AND @reminder < @due)
    SET @reminder = CASE WHEN @due - 2 > @open THEN @due - 2 ELSE @open + 1 END;

UPDATE dbo.app_settings SET setting_value = CAST(@open AS NVARCHAR(10)) WHERE setting_key = 'monthly_documents_open_day';
UPDATE dbo.app_settings SET setting_value = CAST(@reminder AS NVARCHAR(10)) WHERE setting_key = 'monthly_documents_reminder_day';
UPDATE dbo.app_settings SET setting_value = CAST(@due AS NVARCHAR(10)) WHERE setting_key = 'monthly_documents_due_day';
GO
