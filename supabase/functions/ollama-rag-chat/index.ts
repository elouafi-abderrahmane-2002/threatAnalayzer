import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  clientId: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  ollamaUrl?: string; // Allow custom Ollama URL
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting RAG chat request...');
    
    const { message, clientId, conversationHistory = [], ollamaUrl = 'http://localhost:11434' } = await req.json() as ChatRequest;
    
    if (!message || !clientId) {
      throw new Error('Message and clientId are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating embeddings for query...');
    
    // Generate embedding for the user's question
    const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: message
      })
    });

    if (!embeddingResponse.ok) {
      console.error('Ollama embedding error:', await embeddingResponse.text());
      throw new Error('Failed to generate embeddings from Ollama');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding;

    console.log('Searching for relevant knowledge...');

    // Search for relevant knowledge using vector similarity
    const { data: relevantDocs, error: searchError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
      filter_client_id: clientId
    });

    if (searchError) {
      console.error('Knowledge search error:', searchError);
    }

    // Build context from relevant documents
    let context = '';
    if (relevantDocs && relevantDocs.length > 0) {
      context = 'Relevant information from the knowledge base:\n\n' + 
        relevantDocs.map((doc: any, index: number) => 
          `${index + 1}. ${doc.content}\n`
        ).join('\n') + '\n\n';
      
      console.log(`Found ${relevantDocs.length} relevant documents`);
    } else {
      console.log('No relevant documents found');
    }

    // Prepare messages for Ollama
    const systemPrompt = `You are a helpful AI assistant with access to a knowledge base. ${context ? 'Use the provided context to answer questions when relevant, but you can also use your general knowledge.' : 'Answer based on your general knowledge.'}

${context}

Please provide a comprehensive and helpful response.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    console.log('Generating response with Ollama...');

    // Generate response using Ollama
    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama2', // or 'llama3.2' if available
        messages: messages,
        stream: false
      })
    });

    if (!chatResponse.ok) {
      console.error('Ollama chat error:', await chatResponse.text());
      throw new Error('Failed to get response from Ollama');
    }

    const chatData = await chatResponse.json();
    const aiResponse = chatData.message?.content || 'I apologize, but I could not generate a response.';

    console.log('RAG chat completed successfully');

    return new Response(JSON.stringify({
      response: aiResponse,
      context: {
        documentsFound: relevantDocs?.length || 0,
        hasContext: !!context
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ollama-rag-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({
      error: errorMessage,
      response: 'I apologize, but I encountered an error processing your request. Please ensure Ollama is running and try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});