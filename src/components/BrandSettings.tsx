import { useRef, useState } from 'react';
import { useBrand } from '@/hooks/useBrand';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Save, 
  Loader2,
  Upload,
  Trash2,
  RotateCcw,
  Palette,
  ImageIcon
} from 'lucide-react';

export function BrandSettings() {
  const { brand, updateBrand, saveBrand, isSaving, resetBrand } = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(brand.logoUrl);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        updateBrand({ logoUrl: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setPreviewUrl(null);
    updateBrand({ logoUrl: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/5 to-neon-pink/5 pointer-events-none" />
      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/20 neon-glow-pink">
            <Palette className="h-5 w-5 text-accent" />
          </div>
          <div>
            <CardTitle className="text-accent">Brand / Marca</CardTitle>
            <CardDescription>
              Personalize o nome e logo do seu sistema
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 relative">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-start gap-4">
            <div 
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Logo preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-2">
                  <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground mt-1 block">Upload</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Fazer upload
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                PNG, JPG ou SVG. Máximo 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <Label htmlFor="appName">Nome do Sistema</Label>
          <Input
            id="appName"
            type="text"
            placeholder="Lead Extractor"
            value={brand.appName}
            onChange={(e) => updateBrand({ appName: e.target.value })}
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground">
            Esse nome aparecerá no menu lateral e navegação
          </p>
        </div>

        {/* App Subtitle */}
        <div className="space-y-2">
          <Label htmlFor="appSubtitle">Subtítulo</Label>
          <Input
            id="appSubtitle"
            type="text"
            placeholder="SERP + Evolution"
            value={brand.appSubtitle}
            onChange={(e) => updateBrand({ appSubtitle: e.target.value })}
            maxLength={30}
          />
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label>Pré-visualização</Label>
          <div className="p-4 rounded-lg bg-sidebar border border-sidebar-border">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden neon-glow-cyan">
                  <img 
                    src={previewUrl} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-primary neon-glow-cyan">
                  <Palette className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-primary neon-text-cyan logo-text tracking-wider">
                  {brand.appName || 'Lead Extractor'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {brand.appSubtitle || 'SERP + Evolution'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button onClick={saveBrand} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Marca
          </Button>
          <Button variant="ghost" onClick={resetBrand}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
