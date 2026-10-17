import { create } from 'zustand';
import type { User } from '@/types';
import { clearStoredTokens, saveStoredTokens } from '@/api/client';

interface AuthState {
  user: User | null;
  hydrated: boolean;
  set: (user: User, tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => void;
  setUser: (user: User | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  set: (user, tokens) => {
    saveStoredTokens(tokens);
    set({ user, hydrated: true });
  },
  setUser: (user) => set({ user }),
  clear: () => {
    clearStoredTokens();
    set({ user: null });
  },
}));
