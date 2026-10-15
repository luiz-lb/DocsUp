-- =============================================================================
-- DocsUp — schema base (versão 0001_schema_inicial)
--
-- Origem: export do SSMS do banco SupplierManagementPreview (15/10/2026).
-- Tabelas, índices, defaults, FKs e CHECK foram mantidos sem alteração.
-- Removido do export, porque o init-db.sh cuida disso ou porque não roda no container:
--   * CREATE DATABASE com caminhos de arquivo do Windows e os ALTER DATABASE
--     (inclusive COMPATIBILITY_LEVEL 170, do SQL Server 2025; o container é 2022);
--   * USE [...] (o init-db.sh conecta direto no database);
--   * CREATE USER [dev]/[everest] e o db_owner deles (o usuário da aplicação é
--     criado em 04_app_user.sql com permissão mínima).
--
-- Executado UMA vez pelo init-db.sh, dentro de uma transação, e registrado em
-- dbo.schema_migrations. Alterações de schema daqui em diante vão em
-- database/migrations/ (ver database/README.md).
-- =============================================================================
/****** Objeto:  Table [dbo].[activity_types]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[activity_types](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[risk_level] [tinyint] NULL,
	[description] [nvarchar](max) NULL,
	[is_active] [bit] NULL,
	[nr_type_id] [varchar](100) NOT NULL,
	[document_type_id] [varchar](100) NOT NULL,
	[is_mandatory] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_activity_types_name] UNIQUE NONCLUSTERED 
(
	[name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[audit_log]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[audit_log](
	[id] [bigint] IDENTITY(1,1) NOT NULL,
	[actor_type] [tinyint] NOT NULL,
	[actor_id] [int] NULL,
	[action] [varchar](100) NOT NULL,
	[entity_type] [varchar](50) NOT NULL,
	[entity_id] [int] NULL,
	[old_values] [nvarchar](max) NULL,
	[new_values] [nvarchar](max) NULL,
	[ip_address] [varchar](45) NULL,
	[user_agent] [nvarchar](max) NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[document_types]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[document_types](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[scope] [tinyint] NOT NULL,
	[validation_method] [tinyint] NOT NULL,
	[api_endpoint] [varchar](500) NULL,
	[required_fields] [nvarchar](max) NULL,
	[validity_days] [int] NULL,
	[description] [nvarchar](max) NULL,
	[is_active] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[document_validations]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[document_validations](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[document_id] [int] NOT NULL,
	[validation_type] [tinyint] NOT NULL,
	[ai_score] [decimal](5, 2) NULL,
	[ai_result_json] [nvarchar](max) NULL,
	[ai_model_used] [varchar](100) NULL,
	[api_response] [nvarchar](max) NULL,
	[api_valid] [bit] NULL,
	[reviewer_id] [int] NULL,
	[reviewer_department] [varchar](50) NULL,
	[manual_decision] [tinyint] NULL,
	[manual_comments] [nvarchar](max) NULL,
	[reviewed_at] [datetime2](7) NULL,
	[final_status] [tinyint] NOT NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[documents]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[documents](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[document_type_id] [int] NOT NULL,
	[labor_request_id] [int] NULL,
	[employee_id] [int] NULL,
	[file_name] [nvarchar](500) NOT NULL,
	[file_path] [nvarchar](1000) NOT NULL,
	[file_size_bytes] [bigint] NULL,
	[mime_type] [varchar](100) NULL,
	[file_hash] [varchar](128) NULL,
	[version] [int] NULL,
	[is_current] [bit] NULL,
	[status] [tinyint] NULL,
	[expires_at] [date] NULL,
	[uploaded_at] [datetime2](7) NULL,
	[updated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_documents_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[employee_nrs]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[employee_nrs](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[employee_id] [int] NOT NULL,
	[nr_type_id] [int] NOT NULL,
	[certificate_doc_id] [int] NULL,
	[expiration_date] [date] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_emp_nrs] UNIQUE NONCLUSTERED 
(
	[employee_id] ASC,
	[nr_type_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[employees]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[employees](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[labor_request_id] [int] NULL,
	[full_name] [nvarchar](300) NOT NULL,
	[cpf] [varchar](14) NULL,
	[rg] [varchar](20) NULL,
	[role_function] [nvarchar](200) NULL,
	[status] [tinyint] NULL,
	[created_at] [datetime2](7) NULL,
	[updated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_employees_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[invoices]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[invoices](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[purchase_order_id] [int] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[nf_number] [varchar](50) NOT NULL,
	[nf_file_name] [nvarchar](500) NULL,
	[nf_file_path] [nvarchar](1000) NULL,
	[nf_value] [decimal](15, 2) NULL,
	[expected_file_name] [nvarchar](500) NULL,
	[status] [tinyint] NULL,
	[denial_reason] [nvarchar](max) NULL,
	[received_at] [datetime2](7) NULL,
	[validated_at] [datetime2](7) NULL,
	[paid_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_invoices_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[labor_request_approvals]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[labor_request_approvals](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[approver_id] [int] NULL,
	[department] [varchar](50) NOT NULL,
	[decision] [tinyint] NULL,
	[comments] [nvarchar](max) NULL,
	[decided_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_lr_approvals_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[labor_request_documents]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[labor_request_documents](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[document_type_id] [int] NOT NULL,
	[added_by] [int] NULL,
	[notes] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_lr_docs] UNIQUE NONCLUSTERED 
(
	[labor_request_id] ASC,
	[document_type_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[labor_request_NRs]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[labor_request_NRs](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[nr_type_id] [int] NOT NULL,
	[added_by] [int] NOT NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[labor_requests]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[labor_requests](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[request_number]  AS ([id]) PERSISTED NOT NULL,
	[requester_id] [int] NOT NULL,
	[activity_type_id] [int] NOT NULL,
	[title] [nvarchar](300) NOT NULL,
	[description] [nvarchar](max) NULL,
	[location] [nvarchar](300) NULL,
	[start_date] [date] NULL,
	[end_date] [date] NULL,
	[urgency] [tinyint] NULL,
	[status] [tinyint] NULL,
	[created_at] [datetime2](7) NULL,
	[updated_at] [datetime2](7) NULL,
	[update_by_id] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_labor_requests_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[notifications]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[notifications](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[recipient_type] [tinyint] NOT NULL,
	[recipient_id] [int] NOT NULL,
	[channel] [tinyint] NOT NULL,
	[event_type] [varchar](50) NOT NULL,
	[title] [nvarchar](300) NOT NULL,
	[message] [nvarchar](max) NULL,
	[reference_type] [varchar](50) NULL,
	[reference_id] [int] NULL,
	[email_sent] [bit] NULL,
	[email_sent_at] [datetime2](7) NULL,
	[read_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[nr_types]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[nr_types](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[code] [varchar](10) NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[description] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_nr_types_code] UNIQUE NONCLUSTERED 
(
	[code] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[payment_blocks]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[payment_blocks](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[purchase_order_id] [int] NULL,
	[invoice_id] [int] NULL,
	[labor_request_id] [int] NULL,
	[block_reason] [tinyint] NOT NULL,
	[blocked_documents] [nvarchar](max) NULL,
	[payment_due_date] [date] NULL,
	[doc_deadline] [date] NULL,
	[status] [tinyint] NULL,
	[notified_at] [datetime2](7) NULL,
	[resolved_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_blocks_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[phase2_deadlines]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[phase2_deadlines](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[quotation_id] [int] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[link_token] [varchar](200) NOT NULL,
	[deadline_hours] [int] NOT NULL,
	[started_at] [datetime2](7) NOT NULL,
	[expires_at] [datetime2](7) NOT NULL,
	[status] [tinyint] NULL,
	[completed_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_phase2_quotation] UNIQUE NONCLUSTERED 
(
	[quotation_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_phase2_token] UNIQUE NONCLUSTERED 
(
	[link_token] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_phase2_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[purchase_orders]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[purchase_orders](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[labor_request_id] [int] NULL,
	[quotation_id] [int] NULL,
	[supplier_id] [int] NOT NULL,
	[po_number] [varchar](50) NOT NULL,
	[po_value] [decimal](15, 2) NULL,
	[accounting_code] [varchar](50) NULL,
	[status] [tinyint] NULL,
	[system_request_number] [int] NULL,
	[created_at] [datetime2](7) NULL,
	[updated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_po_number] UNIQUE NONCLUSTERED 
(
	[po_number] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_po_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[quotation_company_checklist]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[quotation_company_checklist](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[quotation_id] [int] NOT NULL,
	[document_type_id] [int] NOT NULL,
	[has_document] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quot_checklist] UNIQUE NONCLUSTERED 
(
	[quotation_id] ASC,
	[document_type_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[quotation_invites]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[quotation_invites](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[round_id] [int] NOT NULL,
	[supplier_id] [int] NULL,
	[invite_token] [varchar](200) NOT NULL,
	[invite_email] [nvarchar](200) NULL,
	[status] [tinyint] NULL,
	[sent_at] [datetime2](7) NULL,
	[viewed_at] [datetime2](7) NULL,
	[responded_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quot_invites_token] UNIQUE NONCLUSTERED 
(
	[invite_token] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quot_invites_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[quotation_nr_declarations]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[quotation_nr_declarations](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[quotation_id] [int] NOT NULL,
	[nr_type_id] [int] NOT NULL,
	[employee_count] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quot_nr] UNIQUE NONCLUSTERED 
(
	[quotation_id] ASC,
	[nr_type_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[quotation_rounds]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[quotation_rounds](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[round_number] [int] NULL,
	[status] [tinyint] NULL,
	[deadline] [datetime2](7) NOT NULL,
	[created_by] [int] NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quot_rounds_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[quotations]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[quotations](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[round_id] [int] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[invite_id] [int] NULL,
	[total_value] [decimal](15, 2) NOT NULL,
	[currency] [varchar](3) NULL,
	[notes] [nvarchar](max) NULL,
	[checklist_accepted] [bit] NULL,
	[omission_warning_accepted] [bit] NULL,
	[acceptance_ip] [varchar](45) NULL,
	[acceptance_at] [datetime2](7) NULL,
	[acceptance_user_agent] [nvarchar](max) NULL,
	[status] [tinyint] NULL,
	[ranking] [int] NULL,
	[submitted_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_quotations_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[regions]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[regions](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[city] [nvarchar](150) NULL,
	[state] [varchar](2) NOT NULL,
	[country] [varchar](3) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[service_categories]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[service_categories](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](150) NOT NULL,
	[description] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_service_categories_name] UNIQUE NONCLUSTERED 
(
	[name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[submission_receipts]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[submission_receipts](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[quotation_id] [int] NULL,
	[supplier_id] [int] NOT NULL,
	[receipt_type] [tinyint] NOT NULL,
	[pdf_path] [nvarchar](1000) NOT NULL,
	[generated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_receipts_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_categories]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_categories](
	[supplier_id] [int] NOT NULL,
	[category_id] [int] NOT NULL,
 CONSTRAINT [PK_supplier_categories] PRIMARY KEY CLUSTERED 
(
	[supplier_id] ASC,
	[category_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_contacts]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_contacts](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[email] [nvarchar](200) NOT NULL,
	[phone] [varchar](20) NULL,
	[contact_type] [tinyint] NOT NULL,
	[is_primary] [bit] NULL,
	[created_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_supplier_contacts_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_evaluations]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_evaluations](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[supplier_id] [int] NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[evaluator_id] [int] NOT NULL,
	[evaluator_role] [tinyint] NOT NULL,
	[score] [decimal](4, 2) NOT NULL,
	[comments] [nvarchar](max) NULL,
	[evaluated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_evaluations_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_refresh_requests]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_refresh_requests](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[supplier_id] [int] NOT NULL,
	[requested_at] [datetime2](7) NULL,
	[deadline_at] [datetime2](7) NOT NULL,
	[completed_at] [datetime2](7) NULL,
	[status] [tinyint] NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_regions]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_regions](
	[supplier_id] [int] NOT NULL,
	[region_id] [int] NOT NULL,
 CONSTRAINT [PK_supplier_regions] PRIMARY KEY CLUSTERED 
(
	[supplier_id] ASC,
	[region_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[supplier_scores]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[supplier_scores](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[supplier_id] [int] NOT NULL,
	[labor_request_id] [int] NOT NULL,
	[quotation_delivery_score] [decimal](4, 2) NULL,
	[quotation_delivery_days] [int] NULL,
	[documentation_score] [decimal](4, 2) NULL,
	[rework_count] [int] NULL,
	[rework_penalty] [decimal](4, 2) NULL,
	[evaluation_score] [decimal](4, 2) NULL,
	[weight_quotation] [decimal](3, 1) NULL,
	[weight_documentation] [decimal](3, 1) NULL,
	[weight_evaluation] [decimal](3, 1) NULL,
	[final_score] [decimal](5, 2) NULL,
	[deadline_penalty] [decimal](4, 2) NULL,
	[calculated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[suppliers]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[suppliers](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[cnpj] [varchar](18) NOT NULL,
	[razao_social] [nvarchar](300) NOT NULL,
	[nome_fantasia] [nvarchar](300) NULL,
	[cnpj_validated] [bit] NULL,
	[cnpj_status] [varchar](50) NULL,
	[employee_count] [int] NULL,
	[address] [nvarchar](max) NULL,
	[city] [nvarchar](150) NULL,
	[state] [varchar](2) NULL,
	[zip_code] [varchar](10) NULL,
	[phone] [varchar](20) NULL,
	[website] [nvarchar](300) NULL,
	[password_hash] [varchar](500) NOT NULL,
	[mfa_secret] [varchar](200) NULL,
	[mfa_enabled] [bit] NULL,
	[registration_complete] [bit] NULL,
	[last_data_refresh] [datetime2](7) NULL,
	[overall_score] [decimal](5, 2) NULL,
	[status] [tinyint] NULL,
	[created_at] [datetime2](7) NULL,
	[updated_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_suppliers_cnpj] UNIQUE NONCLUSTERED 
(
	[cnpj] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_suppliers_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Objeto:  Table [dbo].[users]    Data do Script: 15/10/2026 09:00:49 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[users](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[uid] [uniqueidentifier] NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[email] [nvarchar](200) NOT NULL,
	[department] [tinyint] NOT NULL,
	[role] [varchar](50) NOT NULL,
	[is_active] [bit] NULL,
	[created_at] [datetime2](7) NULL,
	[password_hash] [varchar](255) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_users_email] UNIQUE NONCLUSTERED 
(
	[email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_users_uid] UNIQUE NONCLUSTERED 
(
	[uid] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_audit_log_created]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_audit_log_created] ON [dbo].[audit_log]
(
	[created_at] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Objeto:  Index [IX_audit_log_entity]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_audit_log_entity] ON [dbo].[audit_log]
(
	[entity_type] ASC,
	[entity_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_document_validations_document]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_document_validations_document] ON [dbo].[document_validations]
(
	[document_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_documents_employee]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_documents_employee] ON [dbo].[documents]
(
	[employee_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_documents_labor_request]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_documents_labor_request] ON [dbo].[documents]
(
	[labor_request_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_documents_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_documents_status] ON [dbo].[documents]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_documents_supplier]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_documents_supplier] ON [dbo].[documents]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_employees_labor_request]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_employees_labor_request] ON [dbo].[employees]
(
	[labor_request_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_employees_supplier]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_employees_supplier] ON [dbo].[employees]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_invoices_purchase_order]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_invoices_purchase_order] ON [dbo].[invoices]
(
	[purchase_order_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_invoices_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_invoices_status] ON [dbo].[invoices]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_labor_requests_requester]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_labor_requests_requester] ON [dbo].[labor_requests]
(
	[requester_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_labor_requests_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_labor_requests_status] ON [dbo].[labor_requests]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_notifications_recipient]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_notifications_recipient] ON [dbo].[notifications]
(
	[recipient_type] ASC,
	[recipient_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_payment_blocks_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_payment_blocks_status] ON [dbo].[payment_blocks]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_payment_blocks_supplier]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_payment_blocks_supplier] ON [dbo].[payment_blocks]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_phase2_deadlines_expires]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_phase2_deadlines_expires] ON [dbo].[phase2_deadlines]
(
	[expires_at] ASC
)
WHERE ([status]=(0))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Objeto:  Index [IX_purchase_orders_po_number]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_purchase_orders_po_number] ON [dbo].[purchase_orders]
(
	[po_number] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_purchase_orders_supplier]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_purchase_orders_supplier] ON [dbo].[purchase_orders]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_quotations_round]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_quotations_round] ON [dbo].[quotations]
(
	[round_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_quotations_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_quotations_status] ON [dbo].[quotations]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_quotations_supplier]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_quotations_supplier] ON [dbo].[quotations]
(
	[supplier_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Objeto:  Index [IX_suppliers_cnpj]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_suppliers_cnpj] ON [dbo].[suppliers]
(
	[cnpj] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Objeto:  Index [IX_suppliers_status]    Data do Script: 15/10/2026 09:00:49 ******/
CREATE NONCLUSTERED INDEX [IX_suppliers_status] ON [dbo].[suppliers]
(
	[status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[activity_types] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[activity_types] ADD  DEFAULT ((1)) FOR [is_mandatory]
GO
ALTER TABLE [dbo].[audit_log] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[document_types] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[document_validations] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT ((1)) FOR [version]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT ((1)) FOR [is_current]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT (sysdatetimeoffset()) FOR [uploaded_at]
GO
ALTER TABLE [dbo].[documents] ADD  DEFAULT (sysdatetimeoffset()) FOR [updated_at]
GO
ALTER TABLE [dbo].[employees] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[employees] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[employees] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[employees] ADD  DEFAULT (sysdatetimeoffset()) FOR [updated_at]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[invoices] ADD  DEFAULT (sysdatetimeoffset()) FOR [received_at]
GO
ALTER TABLE [dbo].[labor_request_approvals] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[labor_request_approvals] ADD  DEFAULT ((0)) FOR [decision]
GO
ALTER TABLE [dbo].[labor_request_approvals] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[labor_request_NRs] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT ((1)) FOR [urgency]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT (sysdatetimeoffset()) FOR [updated_at]
GO
ALTER TABLE [dbo].[labor_requests] ADD  DEFAULT ((4)) FOR [update_by_id]
GO
ALTER TABLE [dbo].[notifications] ADD  DEFAULT ((0)) FOR [email_sent]
GO
ALTER TABLE [dbo].[notifications] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[payment_blocks] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[payment_blocks] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[payment_blocks] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[phase2_deadlines] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[phase2_deadlines] ADD  DEFAULT ((72)) FOR [deadline_hours]
GO
ALTER TABLE [dbo].[phase2_deadlines] ADD  DEFAULT (sysdatetimeoffset()) FOR [started_at]
GO
ALTER TABLE [dbo].[phase2_deadlines] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[purchase_orders] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[purchase_orders] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[purchase_orders] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[purchase_orders] ADD  DEFAULT (sysdatetimeoffset()) FOR [updated_at]
GO
ALTER TABLE [dbo].[quotation_invites] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[quotation_invites] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[quotation_invites] ADD  DEFAULT (sysdatetimeoffset()) FOR [sent_at]
GO
ALTER TABLE [dbo].[quotation_rounds] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[quotation_rounds] ADD  DEFAULT ((1)) FOR [round_number]
GO
ALTER TABLE [dbo].[quotation_rounds] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[quotation_rounds] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT ('BRL') FOR [currency]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT ((0)) FOR [checklist_accepted]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT ((0)) FOR [omission_warning_accepted]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT ((1)) FOR [status]
GO
ALTER TABLE [dbo].[quotations] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[regions] ADD  DEFAULT ('BRA') FOR [country]
GO
ALTER TABLE [dbo].[submission_receipts] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[submission_receipts] ADD  DEFAULT (sysdatetimeoffset()) FOR [generated_at]
GO
ALTER TABLE [dbo].[supplier_contacts] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[supplier_contacts] ADD  DEFAULT ((0)) FOR [is_primary]
GO
ALTER TABLE [dbo].[supplier_contacts] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[supplier_evaluations] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[supplier_evaluations] ADD  DEFAULT (sysdatetimeoffset()) FOR [evaluated_at]
GO
ALTER TABLE [dbo].[supplier_refresh_requests] ADD  DEFAULT (sysdatetimeoffset()) FOR [requested_at]
GO
ALTER TABLE [dbo].[supplier_refresh_requests] ADD  DEFAULT ((0)) FOR [status]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((0)) FOR [rework_count]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((0)) FOR [rework_penalty]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((1)) FOR [weight_quotation]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((3)) FOR [weight_documentation]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((5)) FOR [weight_evaluation]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT ((0)) FOR [deadline_penalty]
GO
ALTER TABLE [dbo].[supplier_scores] ADD  DEFAULT (sysdatetimeoffset()) FOR [calculated_at]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ((0)) FOR [cnpj_validated]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ((0)) FOR [mfa_enabled]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ((0)) FOR [registration_complete]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ((0)) FOR [overall_score]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT ((1)) FOR [status]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[suppliers] ADD  DEFAULT (sysdatetimeoffset()) FOR [updated_at]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT (newsequentialid()) FOR [uid]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT ('SOLICITANTE') FOR [role]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT ((1)) FOR [is_active]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT (sysdatetimeoffset()) FOR [created_at]
GO
ALTER TABLE [dbo].[users] ADD  DEFAULT ('de') FOR [password_hash]
GO
ALTER TABLE [dbo].[document_validations]  WITH CHECK ADD  CONSTRAINT [FK_doc_validations_document] FOREIGN KEY([document_id])
REFERENCES [dbo].[documents] ([id])
GO
ALTER TABLE [dbo].[document_validations] CHECK CONSTRAINT [FK_doc_validations_document]
GO
ALTER TABLE [dbo].[document_validations]  WITH CHECK ADD  CONSTRAINT [FK_doc_validations_reviewer] FOREIGN KEY([reviewer_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[document_validations] CHECK CONSTRAINT [FK_doc_validations_reviewer]
GO
ALTER TABLE [dbo].[documents]  WITH CHECK ADD  CONSTRAINT [FK_documents_doctype] FOREIGN KEY([document_type_id])
REFERENCES [dbo].[document_types] ([id])
GO
ALTER TABLE [dbo].[documents] CHECK CONSTRAINT [FK_documents_doctype]
GO
ALTER TABLE [dbo].[documents]  WITH CHECK ADD  CONSTRAINT [FK_documents_employee] FOREIGN KEY([employee_id])
REFERENCES [dbo].[employees] ([id])
GO
ALTER TABLE [dbo].[documents] CHECK CONSTRAINT [FK_documents_employee]
GO
ALTER TABLE [dbo].[documents]  WITH CHECK ADD  CONSTRAINT [FK_documents_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[documents] CHECK CONSTRAINT [FK_documents_request]
GO
ALTER TABLE [dbo].[documents]  WITH CHECK ADD  CONSTRAINT [FK_documents_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[documents] CHECK CONSTRAINT [FK_documents_supplier]
GO
ALTER TABLE [dbo].[employee_nrs]  WITH CHECK ADD  CONSTRAINT [FK_emp_nrs_doc] FOREIGN KEY([certificate_doc_id])
REFERENCES [dbo].[documents] ([id])
GO
ALTER TABLE [dbo].[employee_nrs] CHECK CONSTRAINT [FK_emp_nrs_doc]
GO
ALTER TABLE [dbo].[employee_nrs]  WITH CHECK ADD  CONSTRAINT [FK_emp_nrs_employee] FOREIGN KEY([employee_id])
REFERENCES [dbo].[employees] ([id])
GO
ALTER TABLE [dbo].[employee_nrs] CHECK CONSTRAINT [FK_emp_nrs_employee]
GO
ALTER TABLE [dbo].[employee_nrs]  WITH CHECK ADD  CONSTRAINT [FK_emp_nrs_nrtype] FOREIGN KEY([nr_type_id])
REFERENCES [dbo].[nr_types] ([id])
GO
ALTER TABLE [dbo].[employee_nrs] CHECK CONSTRAINT [FK_emp_nrs_nrtype]
GO
ALTER TABLE [dbo].[employees]  WITH CHECK ADD  CONSTRAINT [FK_employees_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[employees] CHECK CONSTRAINT [FK_employees_request]
GO
ALTER TABLE [dbo].[employees]  WITH CHECK ADD  CONSTRAINT [FK_employees_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[employees] CHECK CONSTRAINT [FK_employees_supplier]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [FK_invoices_po] FOREIGN KEY([purchase_order_id])
REFERENCES [dbo].[purchase_orders] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [FK_invoices_po]
GO
ALTER TABLE [dbo].[invoices]  WITH CHECK ADD  CONSTRAINT [FK_invoices_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[invoices] CHECK CONSTRAINT [FK_invoices_supplier]
GO
ALTER TABLE [dbo].[labor_request_approvals]  WITH CHECK ADD  CONSTRAINT [FK_lr_approvals_approver] FOREIGN KEY([approver_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[labor_request_approvals] CHECK CONSTRAINT [FK_lr_approvals_approver]
GO
ALTER TABLE [dbo].[labor_request_approvals]  WITH CHECK ADD  CONSTRAINT [FK_lr_approvals_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[labor_request_approvals] CHECK CONSTRAINT [FK_lr_approvals_request]
GO
ALTER TABLE [dbo].[labor_request_documents]  WITH CHECK ADD  CONSTRAINT [FK_lr_docs_doctype] FOREIGN KEY([document_type_id])
REFERENCES [dbo].[document_types] ([id])
GO
ALTER TABLE [dbo].[labor_request_documents] CHECK CONSTRAINT [FK_lr_docs_doctype]
GO
ALTER TABLE [dbo].[labor_request_documents]  WITH CHECK ADD  CONSTRAINT [FK_lr_docs_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[labor_request_documents] CHECK CONSTRAINT [FK_lr_docs_request]
GO
ALTER TABLE [dbo].[labor_request_documents]  WITH CHECK ADD  CONSTRAINT [FK_lr_docs_user] FOREIGN KEY([added_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[labor_request_documents] CHECK CONSTRAINT [FK_lr_docs_user]
GO
ALTER TABLE [dbo].[labor_request_NRs]  WITH CHECK ADD FOREIGN KEY([added_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[labor_request_NRs]  WITH CHECK ADD FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[labor_request_NRs]  WITH CHECK ADD FOREIGN KEY([nr_type_id])
REFERENCES [dbo].[nr_types] ([id])
GO
ALTER TABLE [dbo].[labor_requests]  WITH CHECK ADD  CONSTRAINT [FK_labor_requests_activity] FOREIGN KEY([activity_type_id])
REFERENCES [dbo].[activity_types] ([id])
GO
ALTER TABLE [dbo].[labor_requests] CHECK CONSTRAINT [FK_labor_requests_activity]
GO
ALTER TABLE [dbo].[labor_requests]  WITH CHECK ADD  CONSTRAINT [FK_labor_requests_requester] FOREIGN KEY([requester_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[labor_requests] CHECK CONSTRAINT [FK_labor_requests_requester]
GO
ALTER TABLE [dbo].[payment_blocks]  WITH CHECK ADD  CONSTRAINT [FK_blocks_invoice] FOREIGN KEY([invoice_id])
REFERENCES [dbo].[invoices] ([id])
GO
ALTER TABLE [dbo].[payment_blocks] CHECK CONSTRAINT [FK_blocks_invoice]
GO
ALTER TABLE [dbo].[payment_blocks]  WITH CHECK ADD  CONSTRAINT [FK_blocks_po] FOREIGN KEY([purchase_order_id])
REFERENCES [dbo].[purchase_orders] ([id])
GO
ALTER TABLE [dbo].[payment_blocks] CHECK CONSTRAINT [FK_blocks_po]
GO
ALTER TABLE [dbo].[payment_blocks]  WITH CHECK ADD  CONSTRAINT [FK_blocks_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[payment_blocks] CHECK CONSTRAINT [FK_blocks_request]
GO
ALTER TABLE [dbo].[payment_blocks]  WITH CHECK ADD  CONSTRAINT [FK_blocks_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[payment_blocks] CHECK CONSTRAINT [FK_blocks_supplier]
GO
ALTER TABLE [dbo].[phase2_deadlines]  WITH CHECK ADD  CONSTRAINT [FK_phase2_quotation] FOREIGN KEY([quotation_id])
REFERENCES [dbo].[quotations] ([id])
GO
ALTER TABLE [dbo].[phase2_deadlines] CHECK CONSTRAINT [FK_phase2_quotation]
GO
ALTER TABLE [dbo].[phase2_deadlines]  WITH CHECK ADD  CONSTRAINT [FK_phase2_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[phase2_deadlines] CHECK CONSTRAINT [FK_phase2_request]
GO
ALTER TABLE [dbo].[phase2_deadlines]  WITH CHECK ADD  CONSTRAINT [FK_phase2_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[phase2_deadlines] CHECK CONSTRAINT [FK_phase2_supplier]
GO
ALTER TABLE [dbo].[purchase_orders]  WITH CHECK ADD  CONSTRAINT [FK_po_quotation] FOREIGN KEY([quotation_id])
REFERENCES [dbo].[quotations] ([id])
GO
ALTER TABLE [dbo].[purchase_orders] CHECK CONSTRAINT [FK_po_quotation]
GO
ALTER TABLE [dbo].[purchase_orders]  WITH CHECK ADD  CONSTRAINT [FK_po_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[purchase_orders] CHECK CONSTRAINT [FK_po_request]
GO
ALTER TABLE [dbo].[purchase_orders]  WITH CHECK ADD  CONSTRAINT [FK_po_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[purchase_orders] CHECK CONSTRAINT [FK_po_supplier]
GO
ALTER TABLE [dbo].[quotation_company_checklist]  WITH CHECK ADD  CONSTRAINT [FK_quot_checklist_doctype] FOREIGN KEY([document_type_id])
REFERENCES [dbo].[document_types] ([id])
GO
ALTER TABLE [dbo].[quotation_company_checklist] CHECK CONSTRAINT [FK_quot_checklist_doctype]
GO
ALTER TABLE [dbo].[quotation_company_checklist]  WITH CHECK ADD  CONSTRAINT [FK_quot_checklist_quotation] FOREIGN KEY([quotation_id])
REFERENCES [dbo].[quotations] ([id])
GO
ALTER TABLE [dbo].[quotation_company_checklist] CHECK CONSTRAINT [FK_quot_checklist_quotation]
GO
ALTER TABLE [dbo].[quotation_invites]  WITH CHECK ADD  CONSTRAINT [FK_quot_invites_round] FOREIGN KEY([round_id])
REFERENCES [dbo].[quotation_rounds] ([id])
GO
ALTER TABLE [dbo].[quotation_invites] CHECK CONSTRAINT [FK_quot_invites_round]
GO
ALTER TABLE [dbo].[quotation_invites]  WITH CHECK ADD  CONSTRAINT [FK_quot_invites_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[quotation_invites] CHECK CONSTRAINT [FK_quot_invites_supplier]
GO
ALTER TABLE [dbo].[quotation_nr_declarations]  WITH CHECK ADD  CONSTRAINT [FK_quot_nr_nrtype] FOREIGN KEY([nr_type_id])
REFERENCES [dbo].[nr_types] ([id])
GO
ALTER TABLE [dbo].[quotation_nr_declarations] CHECK CONSTRAINT [FK_quot_nr_nrtype]
GO
ALTER TABLE [dbo].[quotation_nr_declarations]  WITH CHECK ADD  CONSTRAINT [FK_quot_nr_quotation] FOREIGN KEY([quotation_id])
REFERENCES [dbo].[quotations] ([id])
GO
ALTER TABLE [dbo].[quotation_nr_declarations] CHECK CONSTRAINT [FK_quot_nr_quotation]
GO
ALTER TABLE [dbo].[quotation_rounds]  WITH CHECK ADD  CONSTRAINT [FK_quot_rounds_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[quotation_rounds] CHECK CONSTRAINT [FK_quot_rounds_request]
GO
ALTER TABLE [dbo].[quotation_rounds]  WITH CHECK ADD  CONSTRAINT [FK_quot_rounds_user] FOREIGN KEY([created_by])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[quotation_rounds] CHECK CONSTRAINT [FK_quot_rounds_user]
GO
ALTER TABLE [dbo].[quotations]  WITH CHECK ADD  CONSTRAINT [FK_quotations_invite] FOREIGN KEY([invite_id])
REFERENCES [dbo].[quotation_invites] ([id])
GO
ALTER TABLE [dbo].[quotations] CHECK CONSTRAINT [FK_quotations_invite]
GO
ALTER TABLE [dbo].[quotations]  WITH CHECK ADD  CONSTRAINT [FK_quotations_round] FOREIGN KEY([round_id])
REFERENCES [dbo].[quotation_rounds] ([id])
GO
ALTER TABLE [dbo].[quotations] CHECK CONSTRAINT [FK_quotations_round]
GO
ALTER TABLE [dbo].[quotations]  WITH CHECK ADD  CONSTRAINT [FK_quotations_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[quotations] CHECK CONSTRAINT [FK_quotations_supplier]
GO
ALTER TABLE [dbo].[submission_receipts]  WITH CHECK ADD  CONSTRAINT [FK_receipts_quotation] FOREIGN KEY([quotation_id])
REFERENCES [dbo].[quotations] ([id])
GO
ALTER TABLE [dbo].[submission_receipts] CHECK CONSTRAINT [FK_receipts_quotation]
GO
ALTER TABLE [dbo].[submission_receipts]  WITH CHECK ADD  CONSTRAINT [FK_receipts_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[submission_receipts] CHECK CONSTRAINT [FK_receipts_supplier]
GO
ALTER TABLE [dbo].[supplier_categories]  WITH CHECK ADD  CONSTRAINT [FK_supplier_categories_category] FOREIGN KEY([category_id])
REFERENCES [dbo].[activity_types] ([id])
GO
ALTER TABLE [dbo].[supplier_categories] CHECK CONSTRAINT [FK_supplier_categories_category]
GO
ALTER TABLE [dbo].[supplier_categories]  WITH CHECK ADD  CONSTRAINT [FK_supplier_categories_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_categories] CHECK CONSTRAINT [FK_supplier_categories_supplier]
GO
ALTER TABLE [dbo].[supplier_contacts]  WITH CHECK ADD  CONSTRAINT [FK_supplier_contacts_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_contacts] CHECK CONSTRAINT [FK_supplier_contacts_supplier]
GO
ALTER TABLE [dbo].[supplier_evaluations]  WITH CHECK ADD  CONSTRAINT [FK_evaluations_evaluator] FOREIGN KEY([evaluator_id])
REFERENCES [dbo].[users] ([id])
GO
ALTER TABLE [dbo].[supplier_evaluations] CHECK CONSTRAINT [FK_evaluations_evaluator]
GO
ALTER TABLE [dbo].[supplier_evaluations]  WITH CHECK ADD  CONSTRAINT [FK_evaluations_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[supplier_evaluations] CHECK CONSTRAINT [FK_evaluations_request]
GO
ALTER TABLE [dbo].[supplier_evaluations]  WITH CHECK ADD  CONSTRAINT [FK_evaluations_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_evaluations] CHECK CONSTRAINT [FK_evaluations_supplier]
GO
ALTER TABLE [dbo].[supplier_refresh_requests]  WITH CHECK ADD  CONSTRAINT [FK_refresh_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_refresh_requests] CHECK CONSTRAINT [FK_refresh_supplier]
GO
ALTER TABLE [dbo].[supplier_regions]  WITH CHECK ADD  CONSTRAINT [FK_supplier_regions_region] FOREIGN KEY([region_id])
REFERENCES [dbo].[regions] ([id])
GO
ALTER TABLE [dbo].[supplier_regions] CHECK CONSTRAINT [FK_supplier_regions_region]
GO
ALTER TABLE [dbo].[supplier_regions]  WITH CHECK ADD  CONSTRAINT [FK_supplier_regions_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_regions] CHECK CONSTRAINT [FK_supplier_regions_supplier]
GO
ALTER TABLE [dbo].[supplier_scores]  WITH CHECK ADD  CONSTRAINT [FK_scores_request] FOREIGN KEY([labor_request_id])
REFERENCES [dbo].[labor_requests] ([id])
GO
ALTER TABLE [dbo].[supplier_scores] CHECK CONSTRAINT [FK_scores_request]
GO
ALTER TABLE [dbo].[supplier_scores]  WITH CHECK ADD  CONSTRAINT [FK_scores_supplier] FOREIGN KEY([supplier_id])
REFERENCES [dbo].[suppliers] ([id])
GO
ALTER TABLE [dbo].[supplier_scores] CHECK CONSTRAINT [FK_scores_supplier]
GO
ALTER TABLE [dbo].[supplier_evaluations]  WITH CHECK ADD CHECK  (([score]>=(0) AND [score]<=(10)))
GO
