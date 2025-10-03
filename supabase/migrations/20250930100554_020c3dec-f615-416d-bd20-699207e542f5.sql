-- Update knowledge_base to use 768 dimensions for nomic-embed-text model
ALTER TABLE knowledge_base 
ALTER COLUMN embedding TYPE vector(768);

-- Update the match_documents function to use the new dimension
DROP FUNCTION IF EXISTS match_documents(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5,
  filter_client_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  client_id uuid,
  similarity double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.metadata,
    knowledge_base.client_id,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE (filter_client_id IS NULL OR knowledge_base.client_id = filter_client_id)
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
$$;