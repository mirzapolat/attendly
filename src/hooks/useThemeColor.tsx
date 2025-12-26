import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ThemeColorContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
  themeColors: { id: string; name: string; hue: number }[];
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

export const themeColors = [
  { id: 'default', name: 'Emerald', hue: 160 },
  { id: 'blue', name: 'Blue', hue: 220 },
  { id: 'purple', name: 'Purple', hue: 270 },
  { id: 'rose', name: 'Rose', hue: 350 },
  { id: 'orange', name: 'Orange', hue: 25 },
  { id: 'cyan', name: 'Cyan', hue: 185 },
];

export const ThemeColorProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [themeColor, setThemeColorState] = useState('default');

  useEffect(() => {
    if (user) {
      fetchThemeColor();
    }
  }, [user]);

  useEffect(() => {
    if (!user && themeColor !== 'default') {
      setThemeColorState('default');
    }
  }, [user, themeColor]);

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  const fetchThemeColor = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('theme_color')
      .eq('id', user!.id)
      .maybeSingle();

    if (data?.theme_color) {
      setThemeColorState(data.theme_color);
    }
  };

  const applyThemeColor = (colorId: string) => {
    const color = themeColors.find(c => c.id === colorId) || themeColors[0];
    const root = document.documentElement;
    
    // Light mode
    root.style.setProperty('--primary', `${color.hue} 84% 39%`);
    root.style.setProperty('--accent', `${color.hue} 84% 39%`);
    root.style.setProperty('--ring', `${color.hue} 84% 39%`);
    root.style.setProperty('--success', `${color.hue} 84% 39%`);
    root.style.setProperty('--sidebar-ring', `${color.hue} 84% 39%`);
    root.style.setProperty('--sidebar-primary', `${color.hue} 5.9% 10%`);
    
    // Update gradients
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${color.hue}, 84%, 39%) 0%, hsl(${color.hue}, 84%, 29%) 100%)`);
    root.style.setProperty('--shadow-glow', `0 0 20px hsl(${color.hue} 84% 39% / 0.2)`);
  };

  const setThemeColor = async (colorId: string) => {
    setThemeColorState(colorId);
    
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme_color: colorId })
        .eq('id', user.id);
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
