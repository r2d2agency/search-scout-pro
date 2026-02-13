import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandSettings } from '@/components/BrandSettings';
import { 
  Save, 
  TestTube2, 
  Key, 
  Server, 
  Loader2,
  Eye,
  EyeOff,
  Palette,
  Building2
} from 'lucide-react';

export function AdminPanel() {
  const { 
    settings, 
    isLoading, 
    isSaving, 
    updateSettings, 
    saveSettings,
    testSerpConnection,
    testEvolutionConnection
  } = useSettings();
  
  const [showSerpKey, setShowSerpKey] = useState(false);
  const [showEvolutionKey, setShowEvolutionKey] = useState(false);
  const [showCnpjToken, setShowCnpjToken] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Configure as chaves de API e integrações do sistema
        </p>
      </div>

      <Tabs defaultValue="brand" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="brand">
            <Palette className="mr-2 h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="serp">
            <Key className="mr-2 h-4 w-4" />
            SERP API
          </TabsTrigger>
          <TabsTrigger value="evolution">
            <Server className="mr-2 h-4 w-4" />
            Evolution API
          </TabsTrigger>
          <TabsTrigger value="cnpj">
            <Building2 className="mr-2 h-4 w-4" />
            CNPJ API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandSettings />
        </TabsContent>

        <TabsContent value="serp">
          <Card>
            <CardHeader>
              <CardTitle>SERP API</CardTitle>
              <CardDescription>
                Configure a chave da API SERP para realizar pesquisas no Google.
                Obtenha sua chave em{' '}
                <a 
                  href="https://serpapi.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  serpapi.com
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serpApiKey">Chave da API SERP</Label>
                <div className="relative">
                  <Input
                    id="serpApiKey"
                    type={showSerpKey ? 'text' : 'password'}
                    placeholder="Cole sua chave SERP API aqui"
                    value={settings.serpApiKey}
                    onChange={(e) => updateSettings({ serpApiKey: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSerpKey(!showSerpKey)}
                  >
                    {showSerpKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={testSerpConnection}
                  disabled={isLoading || !settings.serpApiKey}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube2 className="mr-2 h-4 w-4" />
                  )}
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle>Evolution API</CardTitle>
              <CardDescription>
                Configure a API Evolution para verificar números de WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolutionApiUrl">URL da API Evolution</Label>
                <Input
                  id="evolutionApiUrl"
                  type="url"
                  placeholder="https://sua-evolution.com"
                  value={settings.evolutionApiUrl}
                  onChange={(e) => updateSettings({ evolutionApiUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolutionApiKey">Chave da API Evolution</Label>
                <div className="relative">
                  <Input
                    id="evolutionApiKey"
                    type={showEvolutionKey ? 'text' : 'password'}
                    placeholder="Cole sua chave Evolution API aqui"
                    value={settings.evolutionApiKey}
                    onChange={(e) => updateSettings({ evolutionApiKey: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowEvolutionKey(!showEvolutionKey)}
                  >
                    {showEvolutionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolutionInstance">Nome da Instância</Label>
                <Input
                  id="evolutionInstance"
                  type="text"
                  placeholder="minha-instancia"
                  value={settings.evolutionInstance}
                  onChange={(e) => updateSettings({ evolutionInstance: e.target.value })}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={testEvolutionConnection}
                  disabled={isLoading || !settings.evolutionApiUrl || !settings.evolutionApiKey}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube2 className="mr-2 h-4 w-4" />
                  )}
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cnpj">
          <Card>
            <CardHeader>
              <CardTitle>API CNPJ (Gleego)</CardTitle>
              <CardDescription>
                Configure o token da API para consulta de CNPJ.
                Obtenha seu token em{' '}
                <a 
                  href="https://cnpj.gleego.com.br" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  cnpj.gleego.com.br
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cnpjApiToken">Token da API CNPJ</Label>
                <div className="relative">
                  <Input
                    id="cnpjApiToken"
                    type={showCnpjToken ? 'text' : 'password'}
                    placeholder="Cole seu token da API CNPJ aqui"
                    value={settings.cnpjApiToken}
                    onChange={(e) => updateSettings({ cnpjApiToken: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCnpjToken(!showCnpjToken)}
                  >
                    {showCnpjToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este token será usado para consultas de CNPJ disponíveis para todos os usuários do sistema.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
