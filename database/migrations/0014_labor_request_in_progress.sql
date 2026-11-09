-- =============================================================================
-- 0014: status "Serviço em andamento"
--
-- labor_requests.status:
--   5 passa a se chamar "Pendente de documentação" (Compras indicou o fornecedor; vale até o
--     RH aprovar todos os documentos iniciais). Só o nome muda: o valor continua 5.
--   8 (novo) "Serviço em andamento": o RH aprovou todos os documentos iniciais do contrato.
--     A mudança 5 → 8 é automática, na aprovação do último documento. Reenviar o convite ou
--     trocar o fornecedor voltam para 5; Concluir contrato vale em 5 e em 8.
--
-- Solicitações que já estão com tudo aprovado passam para 8 aqui. "Tudo aprovado" no vínculo
-- ativo (declaração assinada) do fornecedor:
--   * cada documento da empresa declarado tem a entrega atual aprovada;
--   * cada documento de colaborador declarado tem, no mínimo, a quantidade declarada de
--     colaboradores com a entrega atual aprovada;
--   * cada colaborador do contrato (menos os desligados) tem os básicos exigidos aprovados.
-- Documentos mensais (reference_month) não entram.
-- =============================================================================
;WITH active AS (
    SELECT l.id AS assignment_id, l.labor_request_id, l.supplier_id
    FROM dbo.labor_request_suppliers AS l
    INNER JOIN dbo.labor_requests AS lr ON lr.id = l.labor_request_id
    WHERE l.[status] = 1
      AND lr.[status] = 5
),
approved AS (
    SELECT d.supplier_id, d.labor_request_id, d.document_type_id, d.employee_id
    FROM dbo.documents AS d
    WHERE d.reference_month IS NULL
      AND d.is_current = 1
      AND d.[status] = 2
      AND d.labor_request_id IS NOT NULL
),
complete AS (
    SELECT a.labor_request_id
    FROM active AS a
    WHERE NOT EXISTS (
            -- documento da empresa declarado sem aprovação
            SELECT 1
            FROM dbo.labor_request_supplier_declarations AS x
            WHERE x.labor_request_supplier_id = a.assignment_id
              AND x.has_document = 1
              AND NOT EXISTS (
                  SELECT 1 FROM approved AS ap
                  WHERE ap.supplier_id = a.supplier_id
                    AND ap.labor_request_id = a.labor_request_id
                    AND ap.document_type_id = x.document_type_id
                    AND ap.employee_id IS NULL
              )
        )
      AND NOT EXISTS (
            -- documento de colaborador com menos aprovados do que o declarado
            SELECT 1
            FROM dbo.labor_request_supplier_declarations AS x
            WHERE x.labor_request_supplier_id = a.assignment_id
              AND x.employee_count IS NOT NULL
              AND (SELECT COUNT(DISTINCT ap.employee_id) FROM approved AS ap
                   WHERE ap.supplier_id = a.supplier_id
                     AND ap.labor_request_id = a.labor_request_id
                     AND ap.document_type_id = x.document_type_id
                     AND ap.employee_id IS NOT NULL) < x.employee_count
        )
      AND NOT EXISTS (
            -- colaborador sem um básico exigido aprovado
            SELECT 1
            FROM dbo.employees AS e
            INNER JOIN dbo.labor_request_documents AS lrd ON lrd.labor_request_id = a.labor_request_id
            INNER JOIN dbo.document_types AS dt ON dt.id = lrd.document_type_id AND dt.category = 1 AND dt.is_active = 1
            WHERE e.supplier_id = a.supplier_id
              AND e.labor_request_id = a.labor_request_id
              AND ISNULL(e.[status], 0) <> 5
              AND NOT EXISTS (
                  SELECT 1 FROM approved AS ap
                  WHERE ap.supplier_id = a.supplier_id
                    AND ap.labor_request_id = a.labor_request_id
                    AND ap.document_type_id = dt.id
                    AND ap.employee_id = e.id
              )
        )
)
UPDATE lr
SET [status] = 8,
    updated_at = GETDATE()
FROM dbo.labor_requests AS lr
INNER JOIN complete AS c ON c.labor_request_id = lr.id
WHERE lr.[status] = 5;
GO
