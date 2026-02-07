import React, { ReactNode } from 'react';
import { BrandContext, useBrandState } from '@/hooks/useBrand';

interface BrandProviderProps {
  children: ReactNode;
}

export function BrandProvider({ children }: BrandProviderProps) {
  const brandState = useBrandState();

  return (
    <BrandContext.Provider value={brandState}>
      {children}
    </BrandContext.Provider>
  );
}
