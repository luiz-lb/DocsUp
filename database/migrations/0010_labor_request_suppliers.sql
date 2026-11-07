-- =============================================================================
-- 0010: fornecedor indicado por e-mail (no lugar da cotação)
--
-- Compras indica o fornecedor de uma solicitação aprovada pelo e-mail dele e define o
-- prazo dos documentos iniciais (em horas ou até uma data). Se o e-mail já é de um usuário
-- do portal, a solicitação aparece direto para o fornecedor; se não, o link do convite
-- leva ao cadastro. O fornecedor declara o que tem e assina o termo antes de enviar os
-- documentos.
--
-- * labor_request_suppliers: o vínculo (convite) da solicitação com o fornecedor.
--     status 0 Aguardando o fornecedor (cadastro / declaração)
--            1 Ativo (declarou e assinou o termo: envia os documentos)
--            2 Bloqueado (declarou não ter um documento da empresa exigido)
--            3 Encerrado (reenviado para o mesmo e-mail ou fornecedor trocado)
--   Só um vínculo aberto (status 0, 1 ou 2) por solicitação.
--   end_reason: 0 Reenviado (recomeça do zero) · 1 Fornecedor trocado.
-- * labor_request_supplier_declarations: o que o fornecedor declarou, por documento:
--   empresa → has_document (tem / não tem); colaborador (NR e outros) → employee_count
--   (quantos funcionários têm o documento; no mínimo 1).
-- * Dados: cada phase2_deadlines (vencedor da cotação) vira um vínculo Ativo, com o mesmo
--   token (os links /fase2/<token> continuam abrindo) e o mesmo prazo. Se a solicitação
--   tiver mais de um, só o mais novo fica aberto; os anteriores ficam encerrados.
--   phase2_deadlines e as tabelas da cotação ficam no banco, sem uso.
-- =============================================================================
CREATE TABLE dbo.labor_request_suppliers (
    id                        INT IDENTITY(1,1) NOT NULL,
    uid                       UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_lr_suppliers_uid DEFAULT NEWID(),
    labor_request_id          INT NOT NULL,
    supplier_id               INT NULL,               -- NULL até o fornecedor se cadastrar / abrir o link
    invite_email              NVARCHAR(200) NOT NULL, -- e-mail informado por Compras (minúsculas)
    invite_token              VARCHAR(200) NOT NULL,  -- link /fase2/<token>
    deadline_at               DATETIME2(0) NOT NULL,  -- prazo dos documentos iniciais (horário local)
    [status]                  TINYINT NOT NULL CONSTRAINT DF_lr_suppliers_status DEFAULT 0,
    created_by                INT NULL,               -- usuário de Compras (NULL nos migrados sem autor)
    created_at                DATETIME2(0) NOT NULL CONSTRAINT DF_lr_suppliers_created_at DEFAULT GETDATE(),
    linked_at                 DATETIME2(0) NULL,      -- quando o fornecedor foi vinculado
    declared_at               DATETIME2(0) NULL,      -- declaração e termo assinados
    declared_by               INT NULL,               -- supplier_users.id de quem assinou
    acceptance_ip             VARCHAR(45) NULL,
    acceptance_user_agent     NVARCHAR(500) NULL,
    blocked_at                DATETIME2(0) NULL,
    ended_at                  DATETIME2(0) NULL,
    ended_by                  INT NULL,
    end_reason                TINYINT NULL,
    end_comment               NVARCHAR(1000) NULL,    -- motivo da troca de fornecedor
    legacy_phase2_deadline_id INT NULL,               -- origem, quando veio da cotação
    CONSTRAINT PK_lr_suppliers PRIMARY KEY (id),
    CONSTRAINT UQ_lr_suppliers_uid UNIQUE (uid),
    CONSTRAINT UQ_lr_suppliers_token UNIQUE (invite_token),
    CONSTRAINT CK_lr_suppliers_status CHECK ([status] BETWEEN 0 AND 3),
    CONSTRAINT CK_lr_suppliers_end_reason CHECK (end_reason IS NULL OR end_reason IN (0, 1)),
    CONSTRAINT FK_lr_suppliers_request FOREIGN KEY (labor_request_id) REFERENCES dbo.labor_requests (id),
    CONSTRAINT FK_lr_suppliers_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers (id),
    CONSTRAINT FK_lr_suppliers_created_by FOREIGN KEY (created_by) REFERENCES dbo.users (id),
    CONSTRAINT FK_lr_suppliers_ended_by FOREIGN KEY (ended_by) REFERENCES dbo.users (id),
    CONSTRAINT FK_lr_suppliers_declared_by FOREIGN KEY (declared_by) REFERENCES dbo.supplier_users (id)
);
GO

-- Um vínculo aberto por solicitação
CREATE UNIQUE NONCLUSTERED INDEX UX_lr_suppliers_open_request
    ON dbo.labor_request_suppliers (labor_request_id)
    WHERE [status] IN (0, 1, 2);
GO

CREATE NONCLUSTERED INDEX IX_lr_suppliers_supplier
    ON dbo.labor_request_suppliers (supplier_id, [status])
    WHERE supplier_id IS NOT NULL;
GO

-- Convites ainda sem fornecedor: o fornecedor que se cadastra com o e-mail os encontra
CREATE NONCLUSTERED INDEX IX_lr_suppliers_invite_email
    ON dbo.labor_request_suppliers (invite_email)
    WHERE supplier_id IS NULL;
GO

CREATE TABLE dbo.labor_request_supplier_declarations (
    id                        INT IDENTITY(1,1) NOT NULL,
    labor_request_supplier_id INT NOT NULL,
    document_type_id          INT NOT NULL,
    has_document              BIT NULL,   -- documento da empresa: tem / não tem
    employee_count            INT NULL,   -- documento de colaborador: quantos funcionários têm
    CONSTRAINT PK_lr_supplier_declarations PRIMARY KEY (id),
    CONSTRAINT UQ_lr_supplier_declarations UNIQUE (labor_request_supplier_id, document_type_id),
    CONSTRAINT CK_lr_supplier_declarations_value CHECK (
        (has_document IS NOT NULL AND employee_count IS NULL)
        OR (has_document IS NULL AND employee_count >= 1)
    ),
    CONSTRAINT FK_lr_supplier_declarations_link FOREIGN KEY (labor_request_supplier_id)
        REFERENCES dbo.labor_request_suppliers (id),
    CONSTRAINT FK_lr_supplier_declarations_doctype FOREIGN KEY (document_type_id)
        REFERENCES dbo.document_types (id)
);
GO

-- Vínculos que vieram da cotação (vencedor + link da Fase 2)
;WITH deadlines AS (
    SELECT
        p.id, p.labor_request_id, p.supplier_id, p.link_token, p.started_at, p.expires_at,
        r.created_by,
        ROW_NUMBER() OVER (PARTITION BY p.labor_request_id ORDER BY p.started_at DESC, p.id DESC) AS rn
    FROM dbo.phase2_deadlines AS p
    LEFT JOIN dbo.quotations       AS q ON q.id = p.quotation_id
    LEFT JOIN dbo.quotation_rounds AS r ON r.id = q.round_id
)
INSERT INTO dbo.labor_request_suppliers
    (labor_request_id, supplier_id, invite_email, invite_token, deadline_at, [status],
     created_by, created_at, linked_at, declared_at, ended_at, end_reason, end_comment,
     legacy_phase2_deadline_id)
SELECT
    d.labor_request_id,
    d.supplier_id,
    COALESCE(
        (SELECT TOP (1) su.email FROM dbo.supplier_users AS su
         WHERE su.supplier_id = d.supplier_id AND su.is_active = 1
         ORDER BY su.[role] DESC),
        N''
    ),
    d.link_token,
    d.expires_at,
    CASE WHEN d.rn = 1 THEN 1 ELSE 3 END,
    d.created_by,
    d.started_at,
    d.started_at,
    d.started_at,
    CASE WHEN d.rn = 1 THEN NULL ELSE d.started_at END,
    CASE WHEN d.rn = 1 THEN NULL ELSE 1 END,
    CASE WHEN d.rn = 1 THEN NULL ELSE N'Vínculo anterior, da cotação (migração 0010).' END,
    d.id
FROM deadlines AS d;
GO

-- O que o vencedor declarou na cotação vira a declaração do vínculo:
-- checklist da empresa (tem / não tem) e colaboradores por NR (só quantidades a partir de 1)
INSERT INTO dbo.labor_request_supplier_declarations
    (labor_request_supplier_id, document_type_id, has_document, employee_count)
SELECT l.id, c.document_type_id, c.has_document, NULL
FROM dbo.labor_request_suppliers AS l
INNER JOIN dbo.phase2_deadlines AS p ON p.id = l.legacy_phase2_deadline_id
INNER JOIN dbo.quotation_company_checklist AS c ON c.quotation_id = p.quotation_id;

INSERT INTO dbo.labor_request_supplier_declarations
    (labor_request_supplier_id, document_type_id, has_document, employee_count)
SELECT l.id, dt.id, NULL, n.employee_count
FROM dbo.labor_request_suppliers AS l
INNER JOIN dbo.phase2_deadlines AS p ON p.id = l.legacy_phase2_deadline_id
INNER JOIN dbo.quotation_nr_declarations AS n ON n.quotation_id = p.quotation_id
INNER JOIN dbo.document_types AS dt ON dt.nr_type_id = n.nr_type_id
WHERE n.employee_count >= 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.labor_request_supplier_declarations AS x
      WHERE x.labor_request_supplier_id = l.id AND x.document_type_id = dt.id
  );
GO
