-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_client_id uuid default null
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  client_id uuid,
  similarity float
)
LANGUAGE SQL
STABLE
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