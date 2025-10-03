import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Bot, User, Brain, AlertCircle, Shield, Activity, Database } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import axios from 'axios';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  context?: {
    events?: number;
    assets?: number;
    documentsFound?: number;
    hasContext?: boolean;
  };
}

interface AIAssistantProps {
  clientId?: string;
  clientName?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ clientId, clientName }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hello! I'm your senior cybersecurity SOC analyst. I specialize in threat detection, incident response, and security operations for ${clientName || 'your organization'}. I can provide detailed analysis of your security events, vulnerability assessments, threat hunting guidance, and strategic security recommendations.

I have access to your current security data including events, alerts, and asset inventory. Feel free to ask me about:
• Threat analysis and incident investigation
• Risk assessment and prioritization  
• Security recommendations and best practices
• Compliance and security frameworks
• MITRE ATT&CK mapping and threat intelligence

What security challenge can I help you tackle today?`,
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Quick action buttons
  const quickActions = [
    { 
      label: 'Threat Analysis', 
      message: 'Perform a comprehensive threat analysis of my recent security events. What are the key threats I should be concerned about?',
      icon: Activity 
    },
    { 
      label: 'Risk Assessment', 
      message: 'Conduct a risk assessment of my current security posture. What are my highest priority vulnerabilities and how should I address them?',
      icon: Shield 
    },
    { 
      label: 'Incident Response Plan', 
      message: 'Based on my current security events, what incident response actions should I take and how should I prioritize them?',
      icon: AlertCircle 
    },
  ];

  const handleSendMessage = async (messageText?: string, useRAG?: boolean) => {
    const messageToSend = messageText || inputValue;
    if (!messageToSend.trim() || !clientId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageToSend,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare conversation history for context
      const conversationHistory = messages
        .slice(-10) // Last 10 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        }));

      // Choose between RAG-enabled chat and regular OpenAI chat
      const functionName = useRAG ? 'ollama-rag-chat' : 'ai-chat';
      
      const { data } = await supabase.functions.invoke(functionName, {
        body: {
          message: messageToSend,
          clientId: clientId,
          conversationHistory: conversationHistory,
        }
      });

      if (data.error) {
        throw new Error(data.error);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: 'ai',
        timestamp: new Date(),
        context: data.context,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get AI response. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your security analysis request. Please ensure you have a stable connection and try again.",
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    handleSendMessage(action.message);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Senior SOC Analyst AI
          <Badge variant="outline" className="ml-auto">
            <Brain className="h-3 w-3 mr-1" />
            Expert AI
          </Badge>
        </CardTitle>
        {!clientId && (
          <p className="text-sm text-muted-foreground">
            Select a client to start analyzing security data
          </p>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Quick Actions */}
        {clientId && messages.length === 1 && (
          <div className="px-4 pb-3">
            <p className="text-sm font-medium mb-2">Quick Actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="flex items-center gap-1"
                  disabled={isLoading}
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendMessage("Search the knowledge base for relevant security policies and procedures", true)}
                className="flex items-center gap-1"
                disabled={isLoading}
              >
                <Database className="h-3 w-3" />
                RAG Search
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.sender === 'ai' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {message.context && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Brain className="h-3 w-3" />
                        <span>
                          {message.context.events !== undefined && message.context.assets !== undefined ? (
                            `Analyzed ${message.context.events} events, ${message.context.assets} assets`
                          ) : message.context.documentsFound !== undefined ? (
                            `Found ${message.context.documentsFound} relevant documents in knowledge base`
                          ) : (
                            'AI Analysis Complete'
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                {message.sender === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex space-x-1 items-center">
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-150"></div>
                    <span className="text-xs text-muted-foreground ml-2">Analyzing security data...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                clientId 
                  ? "Ask about security events, vulnerabilities, or get recommendations..." 
                  : "Select a client to start chatting..."
              }
              disabled={isLoading || !clientId}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading || !clientId}
              size="icon"
              title="Send with OpenAI"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleSendMessage(inputValue, true)}
              disabled={!inputValue.trim() || isLoading || !clientId}
              variant="outline"
              size="icon"
              title="Send with RAG (Ollama + Knowledge Base)"
            >
              <Database className="h-4 w-4" />
            </Button>
          </div>
          {clientId && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>AI analysis • Data from {clientName} • RAG button uses Ollama + Vector DB</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};