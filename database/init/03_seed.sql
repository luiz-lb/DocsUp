-- =============================================================================
-- DocsUp — dados mínimos de catálogo para um banco NOVO (versão 0002_seed_inicial)
--
-- Roda uma única vez (registrado em dbo.schema_migrations). Mesmo assim, cada
-- tabela só é populada se estiver vazia: num banco restaurado com dados, nada é
-- inserido.
--
-- O usuário Admin inicial NÃO é criado aqui: o backend o cria na subida a partir
-- de USER_ADMIN / SENHA_ADMIN (a senha precisa de hash bcrypt).
-- =============================================================================

-- NRs vigentes (a NR-02 e a NR-27 foram revogadas)
IF NOT EXISTS (SELECT 1 FROM dbo.nr_types)
BEGIN
    INSERT INTO dbo.nr_types (code, [name]) VALUES
        ('NR-01', N'Disposições Gerais e Gerenciamento de Riscos Ocupacionais'),
        ('NR-03', N'Embargo e Interdição'),
        ('NR-04', N'Serviços Especializados em Segurança e em Medicina do Trabalho (SESMT)'),
        ('NR-05', N'Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA)'),
        ('NR-06', N'Equipamento de Proteção Individual (EPI)'),
        ('NR-07', N'Programa de Controle Médico de Saúde Ocupacional (PCMSO)'),
        ('NR-08', N'Edificações'),
        ('NR-09', N'Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos'),
        ('NR-10', N'Segurança em Instalações e Serviços em Eletricidade'),
        ('NR-11', N'Transporte, Movimentação, Armazenagem e Manuseio de Materiais'),
        ('NR-12', N'Segurança no Trabalho em Máquinas e Equipamentos'),
        ('NR-13', N'Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento'),
        ('NR-14', N'Fornos'),
        ('NR-15', N'Atividades e Operações Insalubres'),
        ('NR-16', N'Atividades e Operações Perigosas'),
        ('NR-17', N'Ergonomia'),
        ('NR-18', N'Segurança e Saúde no Trabalho na Indústria da Construção'),
        ('NR-19', N'Explosivos'),
        ('NR-20', N'Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis'),
        ('NR-21', N'Trabalhos a Céu Aberto'),
        ('NR-22', N'Segurança e Saúde Ocupacional na Mineração'),
        ('NR-23', N'Proteção Contra Incêndios'),
        ('NR-24', N'Condições Sanitárias e de Conforto nos Locais de Trabalho'),
        ('NR-25', N'Resíduos Industriais'),
        ('NR-26', N'Sinalização de Segurança'),
        ('NR-28', N'Fiscalização e Penalidades'),
        ('NR-29', N'Segurança e Saúde no Trabalho Portuário'),
        ('NR-30', N'Segurança e Saúde no Trabalho Aquaviário'),
        ('NR-31', N'Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura'),
        ('NR-32', N'Segurança e Saúde no Trabalho em Serviços de Saúde'),
        ('NR-33', N'Segurança e Saúde nos Trabalhos em Espaços Confinados'),
        ('NR-34', N'Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval'),
        ('NR-35', N'Trabalho em Altura'),
        ('NR-36', N'Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados'),
        ('NR-37', N'Segurança e Saúde em Plataformas de Petróleo'),
        ('NR-38', N'Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos');
END
GO

-- Tipos de documento. IDs fixos de propósito: o backend ainda usa 1 (Contrato
-- Social) e 8 (Certificado de Treinamento de NR) direto no código
-- (phase2Service.js). Isso deixa de existir na Fase 3.
-- validation_method: 0=API Pública, 1=IA, 2=Manual, 3=Híbrida | scope: 0=Empresa, 1=Colaborador
IF NOT EXISTS (SELECT 1 FROM dbo.document_types)
BEGIN
    SET IDENTITY_INSERT dbo.document_types ON;

    INSERT INTO dbo.document_types (id, [name], scope, validation_method, api_endpoint, is_active) VALUES
        (1, N'Contrato Social',                           0, 2, NULL,          1),
        (2, N'CND Federal',                               0, 0, 'cnd_federal', 1),
        (3, N'Regularidade FGTS (CRF)',                   0, 0, 'crf_fgts',    1),
        (4, N'PGR - Programa de Gerenciamento de Riscos', 0, 1, NULL,          1),
        (5, N'APR - Análise Preliminar de Risco',         0, 1, NULL,          1),
        (6, N'CIPA - Ata de Constituição',                0, 2, NULL,          1),
        (7, N'ASO - Atestado de Saúde Ocupacional',       1, 2, NULL,          1),
        (8, N'Certificado de Treinamento de NR',          1, 1, NULL,          1);

    SET IDENTITY_INSERT dbo.document_types OFF;
END
GO

-- Atividades. nr_type_id / document_type_id seguem o formato atual (IDs separados
-- por vírgula); a Fase 3 troca isso por uma tabela de vínculo. As NRs são
-- resolvidas pelo código, para não depender dos IDs gerados acima.
-- risk_level: 0=Baixo, 1=Médio, 2=Alto, 3=Crítico
IF NOT EXISTS (SELECT 1 FROM dbo.activity_types)
BEGIN
    INSERT INTO dbo.activity_types ([name], risk_level, nr_type_id, document_type_id) VALUES
        (N'Instalação Elétrica', 2,
            ISNULL((SELECT STRING_AGG(CAST(id AS VARCHAR(10)), ',') WITHIN GROUP (ORDER BY id)
                    FROM dbo.nr_types WHERE code IN ('NR-10', 'NR-12')), ''),
            '1,2,3,5'),
        (N'Limpeza e Conservação', 0,
            '',
            '1,2'),
        (N'Soldagem e Corte a Quente', 3,
            ISNULL((SELECT STRING_AGG(CAST(id AS VARCHAR(10)), ',') WITHIN GROUP (ORDER BY id)
                    FROM dbo.nr_types WHERE code IN ('NR-12', 'NR-18', 'NR-20')), ''),
            '1,2,3,4,5,6'),
        (N'Trabalho em Altura', 2,
            ISNULL((SELECT STRING_AGG(CAST(id AS VARCHAR(10)), ',') WITHIN GROUP (ORDER BY id)
                    FROM dbo.nr_types WHERE code IN ('NR-35')), ''),
            '1,2,3,5');
END
GO

-- Regiões: só as capitais, para o cadastro de fornecedor funcionar num banco novo.
-- A lista completa de municípios deve vir de um export do banco atual.
IF NOT EXISTS (SELECT 1 FROM dbo.regions)
BEGIN
    INSERT INTO dbo.regions (city, [state]) VALUES
        (N'Rio Branco', 'AC'),     (N'Maceió', 'AL'),         (N'Macapá', 'AP'),
        (N'Manaus', 'AM'),         (N'Salvador', 'BA'),       (N'Fortaleza', 'CE'),
        (N'Brasília', 'DF'),       (N'Vitória', 'ES'),        (N'Goiânia', 'GO'),
        (N'São Luís', 'MA'),       (N'Cuiabá', 'MT'),         (N'Campo Grande', 'MS'),
        (N'Belo Horizonte', 'MG'), (N'Belém', 'PA'),          (N'João Pessoa', 'PB'),
        (N'Curitiba', 'PR'),       (N'Recife', 'PE'),         (N'Teresina', 'PI'),
        (N'Rio de Janeiro', 'RJ'), (N'Natal', 'RN'),          (N'Porto Alegre', 'RS'),
        (N'Porto Velho', 'RO'),    (N'Boa Vista', 'RR'),      (N'Florianópolis', 'SC'),
        (N'São Paulo', 'SP'),      (N'Aracaju', 'SE'),        (N'Palmas', 'TO');
END
GO
