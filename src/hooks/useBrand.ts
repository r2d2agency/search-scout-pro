import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { toast } from '@/hooks/use-toast';

const BRAND_KEY = 'lead_extractor_brand';

export interface BrandSettings {
  appName: string;
  appSubtitle: string;
  logoUrl: string | null;
}

const defaultBrand: BrandSettings = {
  appName: 'Lead Extractor',
  appSubtitle: 'SERP + Evolution',
  logoUrl: null,
};

interface BrandContextType {
  brand: BrandSettings;
  updateBrand: (updates: Partial<BrandSettings>) => void;
  saveBrand: () => Promise<void>;
  isSaving: boolean;
  resetBrand: () => void;
}

const BrandContext = createContext<BrandContextType | null>(null);

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

export function useBrandState() {
  const [brand, setBrand] = useState<BrandSettings>(defaultBrand);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(BRAND_KEY);
    if (saved) {
      try {
        setBrand(JSON.parse(saved));
      } catch {
        console.error('Erro ao carregar configurações de marca');
      }
    }
  }, []);

  const updateBrand = useCallback((updates: Partial<BrandSettings>) => {
    setBrand(prev => ({ ...prev, ...updates }));
  }, []);

  const saveBrand = useCallback(async () => {
    setIsSaving(true);
    
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
      
      toast({
        title: 'Marca atualizada',
        description: 'As configurações de marca foram salvas com sucesso',
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
  }, [brand]);

  const resetBrand = useCallback(() => {
    setBrand(defaultBrand);
    localStorage.removeItem(BRAND_KEY);
    toast({
      title: 'Marca restaurada',
      description: 'As configurações de marca foram restauradas para o padrão',
    });
  }, []);

  return {
    brand,
    updateBrand,
    saveBrand,
    isSaving,
    resetBrand,
  };
}

export { BrandContext, defaultBrand };
export type { BrandContextType };
