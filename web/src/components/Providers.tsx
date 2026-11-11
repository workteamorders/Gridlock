'use client';

import type { ReactNode } from 'react';
import { ChainProvider } from '@/lib/chain-context';
import { WalletProvider } from '@/lib/wallet';
import { ToastProvider } from './Toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>
        <ChainProvider>{children}</ChainProvider>
      </WalletProvider>
    </ToastProvider>
  );
}
