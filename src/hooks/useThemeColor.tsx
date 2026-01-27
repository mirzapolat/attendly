import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

type ThemeColor = {
  id: string;
  name: string;
  hue?: number;
  hex?: string;
};

interface ThemeColorContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
  themeColors: ThemeColor[];
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);
const WORKSPACE_STORAGE_KEY = 'attendly:workspace';
const THEME_COLOR_STORAGE_KEY = 'attendly:theme-color';

export const themeColors: ThemeColor[] = [
  { id: 'default', name: 'Emerald', hex: '#10b77f' },
  { id: 'teal', name: 'Teal', hex: '#498467' },
  { id: 'cerulean', name: 'Cerulean', hex: '#006E90' },
  { id: 'cyan', name: 'Cyan', hex: '#10a9b7' },
  { id: 'cornflower', name: 'Cornflower', hex: '#5B84EC' },
  { id: 'amethyst', name: 'Amethyst', hex: '#8C54A0' },
  { id: 'brick', name: 'Brick', hex: '#B41825' },
  { id: 'cinnabar', name: 'Cinnabar', hex: '#E74236' },
  { id: 'magenta', name: 'Magenta', hex: '#E34A6F' },
  { id: 'pink', name: 'Pink', hex: '#E868B2' },
  { id: 'carrot', name: 'Carrot', hex: '#F18F01' },
  { id: 'black', name: 'Black', hex: '#040F0F' },
];

const normalizeHex = (hex: string) => {
  const cleaned = hex.trim().replace(/^#/, '').toLowerCase();
  if (cleaned.length === 3) {
    return cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }
  if (cleaned.length === 6) {
    return cleaned;
  }
  return null;
};

const hexToHsl = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
      default:
        h = 0;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readStoredThemeColor = (workspaceId?: string | null) => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (workspaceId) {
    const scoped = localStorage.getItem(`${THEME_COLOR_STORAGE_KEY}:${workspaceId}`);
    if (scoped) {
      return scoped;
    }
  }
  return localStorage.getItem(THEME_COLOR_STORAGE_KEY);
};

const persistThemeColor = (colorId: string, workspaceId?: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(THEME_COLOR_STORAGE_KEY, colorId);
  if (workspaceId) {
    localStorage.setItem(`${THEME_COLOR_STORAGE_KEY}:${workspaceId}`, colorId);
  }
};

export const applyThemeColor = (colorId: string) => {
  const color = themeColors.find((c) => c.id === colorId) || themeColors[0];
  const hslFromHex = color.hex ? hexToHsl(color.hex) : null;
  const hue = hslFromHex?.h ?? color.hue ?? themeColors[0].hue ?? 160;
  const saturation = hslFromHex?.s ?? 84;
  const lightness = hslFromHex?.l ?? 39;
  const gradientEndLightness = clamp(lightness - 10, 0, 100);
  const root = document.documentElement;

  // Light mode
  root.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--accent', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--ring', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--success', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-ring', `${hue} ${saturation}% ${lightness}%`);
  root.style.setProperty('--sidebar-primary', `${hue} 5.9% 10%`);

  // Update gradients
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, hsl(${hue} ${saturation}% ${lightness}%) 0%, hsl(${hue} ${saturation}% ${gradientEndLightness}%) 100%)`
  );
  root.style.setProperty('--shadow-glow', `0 0 20px hsl(${hue} ${saturation}% ${lightness}% / 0.2)`);
};

export const ThemeColorProvider = ({ children }: { children: ReactNode }) => {
  const { currentWorkspace, currentWorkspaceId, loading, refresh } = useWorkspace();
  const [themeColor, setThemeColorState] = useState(() => {
    if (typeof window === 'undefined') {
      return 'default';
    }
    const storedWorkspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return readStoredThemeColor(storedWorkspaceId) ?? 'default';
  });

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!currentWorkspaceId) {
      setThemeColorState('default');
      return;
    }
    const storedColor = readStoredThemeColor(currentWorkspaceId);
    const nextColor = currentWorkspace?.brand_color ?? storedColor ?? 'default';
    setThemeColorState(nextColor);
    if (currentWorkspace?.brand_color) {
      persistThemeColor(currentWorkspace.brand_color, currentWorkspaceId);
    }
  }, [currentWorkspace?.brand_color, currentWorkspace?.id, currentWorkspaceId, loading]);

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  const setThemeColor = async (colorId: string) => {
    setThemeColorState(colorId);
    const fallbackWorkspaceId =
      typeof window === 'undefined' ? null : localStorage.getItem(WORKSPACE_STORAGE_KEY);
    persistThemeColor(colorId, currentWorkspace?.id ?? fallbackWorkspaceId);
    
    if (currentWorkspace) {
      await supabase
        .from('workspaces')
        .update({ brand_color: colorId })
        .eq('id', currentWorkspace.id);
      await refresh();
    }
  };

  return (
    <ThemeColorContext.Provider value={{ themeColor, setThemeColor, themeColors }}>
      {children}
    </ThemeColorContext.Provider>
  );
};

export const useThemeColor = () => {
  const context = useContext(ThemeColorContext);
  if (!context) {
    throw new Error('useThemeColor must be used within a ThemeColorProvider');
  }
  return context;
};
