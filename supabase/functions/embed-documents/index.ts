import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbedRequest {
  documents: Array<{
    content: string;
    metadata?: Record<string, any>;
  }>;
  clientId: string;
  ollamaUrl?: string;
}

// Function to chunk text into smaller pieces
function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    
    // Move start position with overlap
    start = end - overlap;
    if (start >= text.length) break;
  }
  
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting document embedding process...');
    
    const { documents, clientId, ollamaUrl = 'http://localhost:11434' } = await req.json() as EmbedRequest;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents array is required');
    }
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing ${documents.length} documents...`);

    const embeddedChunks = [];
    let totalChunks = 0;

    for (const doc of documents) {
      console.log('Processing document:', doc.content.substring(0, 100) + '...');
      
      // Chunk the document
      const chunks = chunkText(doc.content);
      totalChunks += chunks.length;
      
      console.log(`Document split into ${chunks.length} chunks`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`);
        
        // Generate embedding using Ollama
        const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: chunk
          })
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error('Ollama embedding error:', errorText);
          continue; // Skip this chunk and continue with the next
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.embedding;

        if (!embedding || !Array.isArray(embedding)) {
          console.error('Invalid embedding received from Ollama');
          continue;
        }

        // Prepare chunk data for database
        embeddedChunks.push({
          content: chunk,
          metadata: {
            ...doc.metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            originalLength: doc.content.length
          },
          embedding: embedding,
          client_id: clientId
        });
      }
    }

    console.log(`Generated embeddings for ${embeddedChunks.length} chunks`);

    if (embeddedChunks.length === 0) {
      throw new Error('No valid embeddings could be generated');
    }

    // Store embeddings in database
    console.log('Storing embeddings in database...');
    
    const { error: insertError } = await supabase
      .from('knowledge_base')
      .insert(embeddedChunks);

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to store embeddings: ${insertError.message}`);
    }

    console.log('Document embedding completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully embedded ${embeddedChunks.length} chunks from ${documents.length} documents`,
      chunksProcessed: embeddedChunks.length,
      documentsProcessed: documents.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in embed-documents:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});