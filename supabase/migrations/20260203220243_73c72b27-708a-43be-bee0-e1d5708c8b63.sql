-- 1) Arquivos: adicionar versionamento e garantir único PDF ativo por orçamento
ALTER TABLE public.arquivos
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Backfill de version (somente PROJETO_PDF) para dados existentes
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY orcamento_id ORDER BY created_at ASC) AS rn
  FROM public.arquivos
  WHERE tipo = 'PROJETO_PDF'
)
UPDATE public.arquivos a
SET version = r.rn
FROM ranked r
WHERE a.id = r.id
  AND a.tipo = 'PROJETO_PDF'
  AND (a.version IS NULL OR a.version = 1);

-- Garantir apenas 1 ativo (o mais recente) por orçamento para PROJETO_PDF
WITH latest AS (
  SELECT id,
         row_number() OVER (PARTITION BY orcamento_id ORDER BY created_at DESC) AS rn
  FROM public.arquivos
  WHERE tipo = 'PROJETO_PDF'
)
UPDATE public.arquivos a
SET ativo = (l.rn = 1)
FROM latest l
WHERE a.id = l.id
  AND a.tipo = 'PROJETO_PDF';

-- Trigger: ao inserir novo PROJETO_PDF, desativa anteriores e incrementa version
CREATE OR REPLACE FUNCTION public.arquivos_before_insert_projeto_pdf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version integer;
BEGIN
  IF NEW.tipo = 'PROJETO_PDF' THEN
    -- desativar qualquer PDF anterior deste orçamento
    UPDATE public.arquivos
      SET ativo = false
      WHERE orcamento_id = NEW.orcamento_id
        AND tipo = 'PROJETO_PDF'
        AND ativo IS DISTINCT FROM false;

    SELECT COALESCE(MAX(version), 0) + 1
      INTO next_version
      FROM public.arquivos
      WHERE orcamento_id = NEW.orcamento_id
        AND tipo = 'PROJETO_PDF';

    NEW.version := next_version;
    NEW.ativo := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_arquivos_before_insert_projeto_pdf ON public.arquivos;
CREATE TRIGGER trg_arquivos_before_insert_projeto_pdf
BEFORE INSERT ON public.arquivos
FOR EACH ROW
EXECUTE FUNCTION public.arquivos_before_insert_projeto_pdf();

-- Índice único: apenas 1 PROJETO_PDF ativo por orçamento
CREATE UNIQUE INDEX IF NOT EXISTS arquivos_unique_active_projeto_pdf
ON public.arquivos (orcamento_id)
WHERE tipo = 'PROJETO_PDF' AND ativo = true;

-- 2) IA extrações: adicionar tipo e payload_json
ALTER TABLE public.ia_extracoes
ADD COLUMN IF NOT EXISTS tipo text;

ALTER TABLE public.ia_extracoes
ADD COLUMN IF NOT EXISTS payload_json jsonb;

-- Melhor esforço: preencher payload_json a partir de dados_brutos
UPDATE public.ia_extracoes
SET payload_json = dados_brutos
WHERE payload_json IS NULL
  AND dados_brutos IS NOT NULL;

-- Melhor esforço: setar tipo para revestimento quando reconhecer estrutura 'ambientes'
UPDATE public.ia_extracoes
SET tipo = 'REVESTIMENTO_MEDIDAS'
WHERE tipo IS NULL
  AND dados_brutos IS NOT NULL
  AND (dados_brutos ? 'ambientes');

-- Índice para buscar a extração mais recente por orçamento + tipo + arquivo
CREATE INDEX IF NOT EXISTS ia_extracoes_lookup_idx
ON public.ia_extracoes (orcamento_id, tipo, arquivo_id, created_at);