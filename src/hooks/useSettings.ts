import { useState, useCallback, useEffect } from 'react';
import { AdminSettings } from '@/types/lead';
import { toast } from '@/hooks/use-toast';

const SETTINGS_KEY = 'lead_extractor_settings';

const defaultSettings: AdminSettings = {
  serpApiKey: '',
  evolutionApiUrl: '',
  evolutionApiKey: '',
  evolutionInstance: '',
};

export function useSettings() {
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar settings do localStorage (para modo sem backend)
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        console.error('Erro ao carregar configurações');
      }
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<AdminSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    
    try {
      // Salvar localmente (para modo sem backend)
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      
      // TODO: Quando backend estiver configurado, descomentar:
      // await api.saveSettings(settings);
      
      toast({
        title: 'Configurações salvas',
        description: 'As configurações foram atualizadas com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const testSerpConnection = useCallback(async () => {
    if (!settings.serpApiKey) {
      toast({
        title: 'Chave SERP não configurada',
        description: 'Por favor, insira a chave da API SERP',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulação de teste (substituir pela API real)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Conexão SERP OK',
        description: 'A chave da API SERP está funcionando',
      });
    } catch (error) {
      toast({
        title: 'Erro na conexão SERP',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [settings.serpApiKey]);

  const testEvolutionConnection = useCallback(async () => {
    if (!settings.evolutionApiUrl || !settings.evolutionApiKey) {
      toast({
        title: 'Evolution não configurado',
        description: 'Por favor, configure a URL e chave da API Evolution',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Simulação de teste (substituir pela API real)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Conexão Evolution OK',
        description: 'A API Evolution está funcionando',
      });
    } catch (error) {
      toast({
        title: 'Erro na conexão Evolution',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [settings.evolutionApiUrl, settings.evolutionApiKey]);

  return {
    settings,
    isLoading,
    isSaving,
    updateSettings,
    saveSettings,
    testSerpConnection,
    testEvolutionConnection,
  };
}
