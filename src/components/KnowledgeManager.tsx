import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Database, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KnowledgeManagerProps {
  clientId?: string;
  clientName?: string;
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({ clientId, clientName }) => {
  const [documents, setDocuments] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleDocumentUpload = async () => {
    if (!documents.trim() || !clientId) {
      toast.error('Please enter document content and select a client');
      return;
    }

    setIsUploading(true);

    try {
      // Split documents by double newlines to handle multiple documents
      const docArray = documents.split('\n\n\n').filter(doc => doc.trim().length > 0);
      
      const documentsToEmbed = docArray.map((content, index) => ({
        content: content.trim(),
        metadata: {
          source: 'manual_upload',
          uploadedAt: new Date().toISOString(),
          documentIndex: index,
          clientName: clientName || 'Unknown'
        }
      }));

      console.log('Uploading documents to RAG system...', documentsToEmbed);

      const { data, error } = await supabase.functions.invoke('embed-documents', {
        body: {
          documents: documentsToEmbed,
          clientId: clientId,
          ollamaUrl: ollamaUrl
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to upload documents');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setUploadedCount(prev => prev + (data?.chunksProcessed || 0));
      setDocuments('');
      
      toast.success(`Successfully embedded ${data?.chunksProcessed || 0} document chunks for RAG system!`);
      
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error(`Failed to upload documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncVulnerabilities = async () => {
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }

    setIsSyncing(true);

    try {
      // Fetch all assets with vulnerabilities for this client
      const { data: assets, error: fetchError } = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId);

      if (fetchError) throw fetchError;

      if (!assets || assets.length === 0) {
        toast.error('No assets found for this client');
        return;
      }

      // Format vulnerabilities as documents
      const documentsToEmbed = [];
      
      for (const asset of assets) {
        const vulnerabilities = (asset.vulnerabilities as any[]) || [];
        
        for (const vuln of vulnerabilities) {
          const content = `Asset: ${asset.name} (${asset.ip_address})
Vulnerability: ${vuln.name || vuln.title || 'Unknown'}
Severity: ${vuln.severity || 'Unknown'}
Status: ${vuln.status || 'Open'}
Description: ${vuln.description || 'No description'}
CVE: ${vuln.cve || 'N/A'}
CVSS Score: ${vuln.cvss_score || 'N/A'}
Remediation: ${vuln.remediation || 'No remediation info'}`;

          documentsToEmbed.push({
            content: content,
            metadata: {
              source: 'vulnerability_sync',
              asset_id: asset.id,
              asset_name: asset.name,
              asset_ip: asset.ip_address,
              vulnerability_name: vuln.name || vuln.title || 'Unknown',
              severity: vuln.severity || 'Unknown',
              cve: vuln.cve || 'N/A',
              syncedAt: new Date().toISOString(),
              clientName: clientName || 'Unknown'
            }
          });
        }
      }

      if (documentsToEmbed.length === 0) {
        toast.error('No vulnerabilities found to sync');
        return;
      }

      console.log(`Syncing ${documentsToEmbed.length} vulnerabilities locally with Ollama...`);

      // Generate embeddings locally using Ollama
      const embeddedChunks = [];
      
      for (const doc of documentsToEmbed) {
        try {
          // Generate embedding using local Ollama
          const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'nomic-embed-text',
              prompt: doc.content
            })
          });

          if (!embeddingResponse.ok) {
            console.error('Failed to generate embedding for document:', doc.content.substring(0, 100));
            continue;
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.embedding;

          if (!embedding || !Array.isArray(embedding)) {
            console.error('Invalid embedding received from Ollama');
            continue;
          }

          embeddedChunks.push({
            content: doc.content,
            metadata: doc.metadata,
            embedding: embedding,
            client_id: clientId
          });
        } catch (error) {
          console.error('Error generating embedding:', error);
          continue;
        }
      }

      if (embeddedChunks.length === 0) {
        throw new Error('No embeddings could be generated. Make sure Ollama is running.');
      }

      console.log(`Generated ${embeddedChunks.length} embeddings, storing in database...`);

      // Store embeddings in database
      const { error: insertError } = await supabase
        .from('knowledge_base')
        .insert(embeddedChunks);

      if (insertError) {
        throw new Error(`Failed to store embeddings: ${insertError.message}`);
      }

      setUploadedCount(prev => prev + embeddedChunks.length);
      
      toast.success(`Successfully synced ${embeddedChunks.length} vulnerabilities to RAG system!`);
      
    } catch (error) {
      console.error('Error syncing vulnerabilities:', error);
      toast.error(`Failed to sync vulnerabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearKnowledge = async () => {
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }

    if (!confirm('Are you sure you want to clear all knowledge base entries for this client?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('client_id', clientId);

      if (error) throw error;

      setUploadedCount(0);
      toast.success('Knowledge base cleared successfully!');
    } catch (error) {
      console.error('Error clearing knowledge base:', error);
      toast.error('Failed to clear knowledge base');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          RAG Knowledge Manager
          <Badge variant="outline" className="ml-auto">
            <FileText className="h-3 w-3 mr-1" />
            Ollama + Vector DB
          </Badge>
        </CardTitle>
        {!clientId && (
          <p className="text-sm text-muted-foreground">
            Select a client to manage their knowledge base
          </p>
        )}
        {clientId && (
          <p className="text-sm text-muted-foreground">
            Managing knowledge for: {clientName} • {uploadedCount} chunks stored
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Ollama Configuration */}
        <div className="space-y-2">
          <Label htmlFor="ollama-url">Ollama Server URL</Label>
          <Input
            id="ollama-url"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            disabled={!clientId}
          />
          <p className="text-xs text-muted-foreground">
            Make sure Ollama is running with nomic-embed-text model (run: ollama pull nomic-embed-text)
          </p>
        </div>

        {/* Document Upload */}
        <div className="space-y-2">
          <Label htmlFor="documents">Add Documents to Knowledge Base</Label>
          <Textarea
            id="documents"
            value={documents}
            onChange={(e) => setDocuments(e.target.value)}
            placeholder="Paste your documents here. Separate multiple documents with triple newlines (&#10;&#10;&#10;)..."
            className="min-h-[200px]"
            disabled={!clientId || isUploading}
          />
          <p className="text-xs text-muted-foreground">
            Documents will be automatically chunked and embedded using Ollama for optimal RAG retrieval
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button 
              onClick={handleDocumentUpload}
              disabled={!documents.trim() || !clientId || isUploading || isSyncing}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Embedding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add to Knowledge Base
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleClearKnowledge}
              disabled={!clientId || isUploading || isSyncing}
            >
              Clear Knowledge
            </Button>
          </div>

          <Button 
            onClick={handleSyncVulnerabilities}
            disabled={!clientId || isUploading || isSyncing}
            variant="secondary"
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing Vulnerabilities...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Sync Vulnerabilities to RAG
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">How to Use:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Sync Vulnerabilities:</strong> Automatically embed all vulnerabilities from the assets table</li>
            <li>• <strong>Add Documents:</strong> Manually add security policies, procedures, or other documents</li>
            <li>• <strong>Ask Questions:</strong> Use the RAG button in AI Assistant to query with Ollama + context</li>
            <li>• All embeddings are generated locally with your Ollama instance (nomic-embed-text model)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};