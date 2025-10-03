-- Add client_id column to logs table
ALTER TABLE public.logs ADD COLUMN client_id uuid;

-- Add foreign key constraint to reference clients table
ALTER TABLE public.logs ADD CONSTRAINT logs_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_logs_client_id ON public.logs(client_id);

-- Update existing logs with a default client (you may need to adjust this based on your data)
-- This assumes you have at least one client in the clients table
UPDATE public.logs 
SET client_id = (SELECT id FROM public.clients LIMIT 1)
WHERE client_id IS NULL;