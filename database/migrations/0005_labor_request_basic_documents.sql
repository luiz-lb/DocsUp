-- =============================================================================
-- 0005: documentos básicos gravados nas solicitações (Fase 4)
--
-- A partir da Fase 4, a aprovação da Segurança do Trabalho grava em
-- labor_request_documents os básicos do colaborador ativos naquele momento
-- (categoria 1): o fornecedor vê como exigido exatamente o que foi aprovado.
--
-- As solicitações aprovadas antes disso não têm os básicos gravados. Esta
-- migração inclui nelas os básicos ativos de agora, para continuarem exigidos.
-- =============================================================================

INSERT INTO dbo.labor_request_documents (labor_request_id, document_type_id, added_by, notes)
SELECT lr.id, dt.id, NULL, N'Básico incluído pela migração 0005 (solicitação aprovada antes da Fase 4).'
FROM dbo.labor_requests AS lr
CROSS JOIN dbo.document_types AS dt
WHERE dt.category = 1
  AND dt.is_active = 1
  -- aprovada pela Segurança, ou já com documentos exigidos gravados
  AND (
      EXISTS (SELECT 1 FROM dbo.labor_request_approvals AS a
              WHERE a.labor_request_id = lr.id AND a.decision = 2)
      OR EXISTS (SELECT 1 FROM dbo.labor_request_documents AS d
                 WHERE d.labor_request_id = lr.id)
  )
  -- só as que ainda não têm nenhum básico gravado (as aprovadas na Fase 4 já têm)
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.labor_request_documents AS d
      INNER JOIN dbo.document_types AS b ON b.id = d.document_type_id
      WHERE d.labor_request_id = lr.id AND b.category = 1
  )
  AND NOT EXISTS (
      SELECT 1 FROM dbo.labor_request_documents AS x
      WHERE x.labor_request_id = lr.id AND x.document_type_id = dt.id
  );
GO
