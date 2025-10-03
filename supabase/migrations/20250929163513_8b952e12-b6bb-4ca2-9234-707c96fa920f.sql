-- Drop the previous table if it exists
DROP TABLE IF EXISTS public.knowledge_base;

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for storing document chunks and their embeddings
CREATE TABLE public.knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1024), -- Reduced dimension for Llama2/7B embeddings
  client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on knowledge_base" 
ON public.knowledge_base 
FOR ALL 
USING (true);

-- Create index for vector similarity search
CREATE INDEX ON public.knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create trigger for updating timestamps
CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();