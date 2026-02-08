import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Database, Zap, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchProgressProps {
  isLoading: boolean;
  source: 'google' | 'instagram';
}

const steps = [
  { icon: Search, label: 'Iniciando pesquisa', duration: 1500 },
  { icon: Database, label: 'Conectando ao servidor', duration: 2000 },
  { icon: Zap, label: 'Processando dados', duration: 3000 },
  { icon: CheckCircle2, label: 'Extraindo leads', duration: 0 },
];

export function SearchProgress({ isLoading, source }: SearchProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setCurrentStep(0);
      return;
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        // Slower progress as it increases
        const increment = Math.max(0.5, (100 - prev) / 50);
        return Math.min(95, prev + increment);
      });
    }, 100);

    // Step animation
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);

    // Pulse animation for the scanning effect
    const pulseInterval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % 8);
    }, 150);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(pulseInterval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-6">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-neon-purple/5 to-neon-pink/5 animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-cyan/10 via-transparent to-transparent opacity-50" />
      
      {/* Scanning lines effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute h-px w-full bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent transition-opacity duration-300",
              pulseIndex === i ? "opacity-100" : "opacity-0"
            )}
            style={{ top: `${12.5 * (i + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-lg neon-text-cyan">
              Pesquisando {source === 'instagram' ? 'Instagram' : 'Google Meu Negócio'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {source === 'instagram' 
                ? 'Conectando à API do Apify...' 
                : 'Buscando estabelecimentos...'}
            </p>
          </div>
        </div>

        {/* Progress bar with glow */}
        <div className="relative mb-6">
          <Progress value={progress} className="h-3 bg-muted/50" />
          {/* Animated glow overlay */}
          <div 
            className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink opacity-80 blur-sm transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute -top-1 -bottom-1 left-0 right-0 bg-gradient-to-r from-neon-cyan/20 via-neon-purple/20 to-neon-pink/20 rounded-full blur-md opacity-50" />
        </div>

        {/* Progress percentage */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-muted-foreground">Progresso</span>
          <span className="text-2xl font-bold font-mono neon-text-cyan">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div
                key={index}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-500",
                  isActive && "bg-primary/20 border border-primary/40",
                  isCompleted && "bg-muted/30",
                  !isActive && !isCompleted && "opacity-40"
                )}
              >
                <div className={cn(
                  "p-2 rounded-full transition-all duration-300",
                  isActive && "bg-primary text-primary-foreground scale-110",
                  isCompleted && "bg-neon-cyan/20 text-neon-cyan",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <StepIcon className={cn("h-4 w-4", isActive && "animate-pulse")} />
                  )}
                </div>
                <span className={cn(
                  "text-xs text-center transition-colors",
                  isActive && "text-primary font-medium",
                  isCompleted && "text-neon-cyan",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -inset-px rounded-lg border border-primary/50 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mt-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
