import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { settingsApi } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Key, Save, Trash2, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface ApiKeyInfo {
  hasKey: boolean;
  maskedKey: string;
  isActive: boolean;
  updatedAt: string;
}

export default function UserSettingsPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeyInfo>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  // Campos de entrada
  const [apifyKey, setApifyKey] = useState('');
  const [showApifyInput, setShowApifyInput] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const keys = await settingsApi.getApiKeys();
      setApiKeys(keys);
    } catch (error) {
      console.error('Erro ao carregar chaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApifyKey = async () => {
    if (!apifyKey.trim()) {
      toast({ title: 'Informe a chave de API', variant: 'destructive' });
      return;
    }

    setSaving('apify');
    try {
      await settingsApi.saveApiKey('apify', apifyKey.trim());
      toast({ title: 'Chave Apify salva com sucesso!' });
      setApifyKey('');
      setShowApifyInput(false);
      loadApiKeys();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveApifyKey = async () => {
    setSaving('apify-remove');
    try {
      await settingsApi.saveApiKey('apify', '');
      toast({ title: 'Chave Apify removida' });
      loadApiKeys();
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const apifyInfo = apiKeys['apify'];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas chaves de API e preferências
        </p>
      </div>

      {/* Chave Apify */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Chave Apify</CardTitle>
            </div>
            {apifyInfo?.hasKey && (
              <Badge variant="default" className="bg-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configurada
              </Badge>
            )}
          </div>
          <CardDescription>
            Sua chave pessoal da Apify para buscas no Instagram. Se não configurar, será usada a chave global do sistema (quando disponível).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apifyInfo?.hasKey && !showApifyInput ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-mono text-sm">{apifyInfo.maskedKey}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atualizada em {new Date(apifyInfo.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApifyInput(true)}
                  >
                    Alterar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveApifyKey}
                    disabled={saving === 'apify-remove'}
                  >
                    {saving === 'apify-remove' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="apify-key">Chave de API</Label>
                <Input
                  id="apify-key"
                  type="password"
                  placeholder="apify_api_..."
                  value={apifyKey}
                  onChange={(e) => setApifyKey(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveApifyKey}
                  disabled={saving === 'apify' || !apifyKey.trim()}
                >
                  {saving === 'apify' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
                {apifyInfo?.hasKey && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowApifyInput(false);
                      setApifyKey('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como obter sua chave Apify</AlertTitle>
            <AlertDescription className="space-y-2">
              <ol className="list-decimal list-inside text-sm space-y-1 mt-2">
                <li>Acesse <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">apify.com <ExternalLink className="h-3 w-3" /></a></li>
                <li>Crie uma conta gratuita (inclui créditos iniciais)</li>
                <li>Vá em Settings → Integrations → API token</li>
                <li>Copie e cole sua API token aqui</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Info sobre plano */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seu Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              {user?.planId?.toUpperCase() || 'FREE'}
            </Badge>
            <span className="text-muted-foreground text-sm">
              Entre em contato com o administrador para upgrade
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
