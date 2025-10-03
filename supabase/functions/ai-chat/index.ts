import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface ChatRequest {
  message: string;
  clientId: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface SecurityEvent {
  event_type?: string;
  severity?: string;
  alert_name?: string;
  host_name?: string;
  host_ip?: string;
  timestamp: string;
  label?: string;
  comments?: string;
  event_id: string;
}

interface Asset {
  name: string;
  ip_address: string;
  status: string;
  vulnerabilities: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { message, clientId, conversationHistory = [] }: ChatRequest = await req.json();

    console.log('Processing chat request for client:', clientId);
    console.log('Message:', message);

    // Fetch recent security events for context
    const { data: events, error: eventsError } = await supabaseClient
      .from('logs')
      .select('*')
      .eq('client_id', clientId)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    // Fetch assets for context
    const { data: assets, error: assetsError } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('client_id', clientId);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }

    // Generate AI response using OpenAI
    const response = await generateAIResponse(message, events || [], assets || [], conversationHistory);

    console.log('Generated AI response successfully');

    return new Response(
      JSON.stringify({ 
        response,
        context: {
          events: events?.length || 0,
          assets: assets?.length || 0
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('AI Chat Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: errorMessage 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

async function generateAIResponse(
  message: string, 
  events: SecurityEvent[], 
  assets: Asset[],
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}>
): Promise<string> {
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Prepare security context
  const securityContext = buildSecurityContext(events, assets);
  
  // Build conversation messages
  const messages = [
    {
      role: 'system',
      content: `You are a senior cybersecurity SOC analyst with extensive experience in threat detection, incident response, and security operations. Your expertise includes:

- Advanced threat hunting and detection
- SIEM/SOAR platform management
- Incident response and forensics
- Vulnerability assessment and management
- Threat intelligence analysis
- MITRE ATT&CK framework
- Compliance frameworks (SOC 2, ISO 27001, NIST)
- Network security and endpoint protection

Current Security Environment Context:
${securityContext}

Instructions:
1. Provide detailed, actionable cybersecurity analysis and recommendations
2. Use industry-standard terminology and best practices
3. Reference specific events, assets, or vulnerabilities from the provided context when relevant
4. Prioritize recommendations based on risk severity
5. Explain the "why" behind your recommendations
6. Be conversational but maintain professional expertise
7. If asked about specific events, provide detailed analysis including potential attack vectors, impact assessment, and remediation steps
8. Always consider the broader security posture and potential attack chains

Respond as a knowledgeable SOC analyst would in a collaborative environment.`
    },
    // Add conversation history
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
    {
      role: 'user',
      content: message
    }
  ];

  try {
    console.log('Calling OpenAI API...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: messages,
        max_completion_tokens: 800,
        temperature: 0.3, // Lower temperature for more consistent, focused responses
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received successfully');
    
    return data.choices[0].message.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Fallback to rule-based response if OpenAI fails
    return generateFallbackResponse(message, events, assets);
  }
}

function buildSecurityContext(events: SecurityEvent[], assets: Asset[]): string {
  let context = '';
  
  if (events.length > 0) {
    const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
    const eventTypes = [...new Set(events.map(e => e.event_type).filter(Boolean))];
    
    context += `Recent Security Events (${events.length} total, ${criticalEvents.length} high/critical):
`;
    
    events.slice(0, 5).forEach((event, i) => {
      context += `${i + 1}. ${event.alert_name || event.event_type} - ${event.severity} severity
   Host: ${event.host_name} (${event.host_ip})
   Time: ${event.timestamp}
   Status: ${event.label || 'Unclassified'}
   Details: ${event.comments || 'No additional details'}
`;
    });
    
    context += `
Common Event Types: ${eventTypes.join(', ')}
`;
  } else {
    context += 'No recent security events detected.\n';
  }

  if (assets.length > 0) {
    const vulnerableAssets = assets.filter(a => a.vulnerabilities && a.vulnerabilities.length > 0);
    const offlineAssets = assets.filter(a => a.status === 'offline');
    
    context += `
Asset Inventory (${assets.length} total):
`;
    
    assets.slice(0, 5).forEach((asset, i) => {
      const vulnCount = Array.isArray(asset.vulnerabilities) ? asset.vulnerabilities.length : 0;
      context += `${i + 1}. ${asset.name} (${asset.ip_address}) - Status: ${asset.status}
   Vulnerabilities: ${vulnCount > 0 ? `${vulnCount} identified` : 'None detected'}
`;
    });
    
    if (vulnerableAssets.length > 0) {
      context += `
High Risk Assets: ${vulnerableAssets.length} assets have identified vulnerabilities requiring attention.`;
    }
    
    if (offlineAssets.length > 0) {
      context += `
Offline Assets: ${offlineAssets.length} assets are currently offline and require investigation.`;
    }
  } else {
    context += '\nNo assets currently registered for monitoring.';
  }

  return context;
}

function generateFallbackResponse(message: string, events: SecurityEvent[], assets: Asset[]): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('event') || lowerMessage.includes('alert')) {
    const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
    return `I've identified ${events.length} security events, with ${criticalEvents.length} requiring immediate attention. As a SOC analyst, I recommend prioritizing the critical events for investigation and implementing proper incident response procedures.`;
  }
  
  if (lowerMessage.includes('asset') || lowerMessage.includes('vulnerability')) {
    const vulnerableAssets = assets.filter(a => a.vulnerabilities && a.vulnerabilities.length > 0);
    return `Current asset assessment shows ${assets.length} monitored systems. ${vulnerableAssets.length} assets have identified vulnerabilities that need remediation. I recommend conducting a risk-based vulnerability management program.`;
  }
  
  return `I'm your cybersecurity SOC analyst assistant. I can help you with threat analysis, incident investigation, vulnerability assessment, and security recommendations. What specific security concerns would you like me to analyze?`;
}