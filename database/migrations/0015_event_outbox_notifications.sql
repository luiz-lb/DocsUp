-- =============================================================================
-- 0015: notificações por eventos (Kafka)
--
-- A API nunca envia e-mail: cada ação grava um evento em event_outbox, na mesma transação
-- da ação, e responde na hora. O serviço notifier publica esses eventos no Kafka (tópicos
-- notifications.supplier e notifications.internal), consome, monta o e-mail e envia.
--
-- * event_outbox: um evento por linha (payload JSON com o tipo, os destinatários e os
--   dados). published_at = publicado no Kafka; enquanto for NULL, o notifier tenta de novo
--   (com espera crescente se o Kafka estiver fora do ar). dedupe_key evita repetir os
--   avisos agendados (ex.: o lembrete do dia 19 de um contrato só uma vez por mês).
-- * notification_deliveries: um envio por evento e destinatário (UNIQUE): o mesmo evento
--   nunca vira dois e-mails, mesmo se o notifier reiniciar no meio. status:
--     0 na fila, 1 enviando, 2 enviado, 3 falhou (vai tentar de novo), 4 fila de erro
--     (5 falhas: DLQ), 5 não enviado (envio de e-mail desligado no servidor).
-- * app_settings: parâmetros das notificações e o calendário dos mensais (abre no dia 1,
--   lembrete no dia 19, prazo no dia 21). O prazo, que era o dia 10, passa a ser 21 (só
--   se ainda estiver no padrão 10).
-- =============================================================================
CREATE TABLE dbo.event_outbox (
    id               BIGINT IDENTITY(1,1) NOT NULL,
    event_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_event_outbox_event_id DEFAULT NEWID(),
    event_type       VARCHAR(100) NOT NULL,
    topic            VARCHAR(100) NOT NULL,
    message_key      NVARCHAR(200) NULL,
    payload          NVARCHAR(MAX) NOT NULL,
    dedupe_key       NVARCHAR(300) NULL,
    created_at       DATETIME2(3) NOT NULL CONSTRAINT DF_event_outbox_created_at DEFAULT SYSDATETIME(),
    published_at     DATETIME2(3) NULL,
    publish_attempts INT NOT NULL CONSTRAINT DF_event_outbox_attempts DEFAULT 0,
    next_attempt_at  DATETIME2(3) NULL,
    claimed_until    DATETIME2(3) NULL,
    last_error       NVARCHAR(1000) NULL,
    CONSTRAINT PK_event_outbox PRIMARY KEY CLUSTERED (id),
    CONSTRAINT UQ_event_outbox_event_id UNIQUE (event_id)
);
GO
CREATE UNIQUE INDEX UX_event_outbox_dedupe ON dbo.event_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;
GO
CREATE INDEX IX_event_outbox_pending ON dbo.event_outbox (id) INCLUDE (next_attempt_at, claimed_until) WHERE published_at IS NULL;
GO

CREATE TABLE dbo.notification_deliveries (
    id              BIGINT IDENTITY(1,1) NOT NULL,
    event_id        UNIQUEIDENTIFIER NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    recipient       NVARCHAR(200) NOT NULL,
    subject         NVARCHAR(300) NULL,
    [status]        TINYINT NOT NULL CONSTRAINT DF_notification_deliveries_status DEFAULT 0,
    attempts        INT NOT NULL CONSTRAINT DF_notification_deliveries_attempts DEFAULT 0,
    next_attempt_at DATETIME2(3) NULL,
    claimed_at      DATETIME2(3) NULL,
    last_error      NVARCHAR(1000) NULL,
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_notification_deliveries_created_at DEFAULT SYSDATETIME(),
    sent_at         DATETIME2(3) NULL,
    updated_at      DATETIME2(3) NULL,
    CONSTRAINT PK_notification_deliveries PRIMARY KEY CLUSTERED (id),
    CONSTRAINT UQ_notification_deliveries_event_recipient UNIQUE (event_id, recipient),
    CONSTRAINT CK_notification_deliveries_status CHECK ([status] BETWEEN 0 AND 5)
);
GO
CREATE INDEX IX_notification_deliveries_retry ON dbo.notification_deliveries ([status], next_attempt_at);
GO
CREATE INDEX IX_notification_deliveries_created ON dbo.notification_deliveries (created_at DESC);
GO

-- Calendário dos documentos mensais e parâmetros das notificações
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'monthly_documents_open_day')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('monthly_documents_open_day', '1');
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'monthly_documents_reminder_day')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('monthly_documents_reminder_day', '19');
UPDATE dbo.app_settings SET setting_value = '21'
WHERE setting_key = 'monthly_documents_due_day' AND setting_value = '10';
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'monthly_documents_due_day')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('monthly_documents_due_day', '21');
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'rh_digest_interval_hours')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('rh_digest_interval_hours', '1');
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'initial_deadline_reminder_hours')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('initial_deadline_reminder_hours', '24');
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'scheduled_notifications_hour')
    INSERT INTO dbo.app_settings (setting_key, setting_value) VALUES ('scheduled_notifications_hour', '8');
GO
