export interface Theme {
  name: string;
  colors: {
    '--cricket-green': string;
    '--pitch-dark': string;
    '--night-gray': string;
    '--light-gray': string;
    '--text-primary': string;
    '--text-secondary': string;
    '--accent-blue': string;
    '--accent-yellow': string;
  };
}

export const themes: Theme[] = [
  {
    name: 'Night Watchman',
    colors: {
      '--cricket-green': '#34D399',
      '--pitch-dark': '#121212',
      '--night-gray': '#1e1e1e',
      '--light-gray': '#2a2a2a',
      '--text-primary': '#E5E7EB',
      '--text-secondary': '#9CA3AF',
      '--accent-blue': '#3B82F6',
      '--accent-yellow': '#F59E0B',
    },
  },
  {
    name: 'Classic Day',
    colors: {
      '--cricket-green': '#28a745',
      '--pitch-dark': '#F3F4F6',
      '--night-gray': '#FFFFFF',
      '--light-gray': '#E5E7EB',
      '--text-primary': '#1F2937',
      '--text-secondary': '#4B5563',
      '--accent-blue': '#007bff',
      '--accent-yellow': '#ffc107',
    },
  },
  {
    name: 'Royal Blue',
    colors: {
      '--cricket-green': '#22C55E',
      '--pitch-dark': '#0A192F',
      '--night-gray': '#172A45',
      '--light-gray': '#304A6E',
      '--text-primary': '#CCD6F6',
      '--text-secondary': '#8892B0',
      '--accent-blue': '#64FFDA',
      '--accent-yellow': '#FBBF24',
    },
  },
  {
    name: 'Sunset Pitch',
    colors: {
      '--cricket-green': '#F97316',
      '--pitch-dark': '#261C15',
      '--night-gray': '#42322B',
      '--light-gray': '#5E473D',
      '--text-primary': '#FED7AA',
      '--text-secondary': '#D97706',
      '--accent-blue': '#60A5FA',
      '--accent-yellow': '#FB923C',
    },
  },
  {
    name: 'Gully Green',
    colors: {
      '--cricket-green': '#84CC16',
      '--pitch-dark': '#1A2E05',
      '--night-gray': '#2A4014',
      '--light-gray': '#3F5820',
      '--text-primary': '#D9F99D',
      '--text-secondary': '#A3E635',
      '--accent-blue': '#7DD3FC',
      '--accent-yellow': '#FDE047',
    },
  },
  {
    name: 'Power Play',
    colors: {
      '--cricket-green': '#EC4899',
      '--pitch-dark': '#111827',
      '--night-gray': '#1F2937',
      '--light-gray': '#374151',
      '--text-primary': '#F9FAFB',
      '--text-secondary': '#D1D5DB',
      '--accent-blue': '#60A5FA',
      '--accent-yellow': '#F472B6',
    },
  },
  {
    name: 'The Ashes',
    colors: {
      '--cricket-green': '#EF4444',
      '--pitch-dark': '#27272A',
      '--night-gray': '#3F3F46',
      '--light-gray': '#52525B',
      '--text-primary': '#E4E4E7',
      '--text-secondary': '#A1A1AA',
      '--accent-blue': '#71717A',
      '--accent-yellow': '#F87171',
    },
  },
  {
    name: 'Dusty Pitch',
    colors: {
      '--cricket-green': '#A16207',
      '--pitch-dark': '#FEF3C7',
      '--night-gray': '#FFFBEB',
      '--light-gray': '#FEF9C3',
      '--text-primary': '#78350F',
      '--text-secondary': '#B45309',
      '--accent-blue': '#38BDF8',
      '--accent-yellow': '#F59E0B',
    },
  },
  {
    name: 'Yorker King',
    colors: {
      '--cricket-green': '#FBCB21',
      '--pitch-dark': '#000000',
      '--night-gray': '#1C1C1E',
      '--light-gray': '#2C2C2E',
      '--text-primary': '#FFFFFF',
      '--text-secondary': '#8E8E93',
      '--accent-blue': '#0A84FF',
      '--accent-yellow': '#FFCC00',
    },
  },
  {
    name: 'T20 Blast',
    colors: {
      '--cricket-green': '#A855F7',
      '--pitch-dark': '#1E1B4B',
      '--night-gray': '#312E81',
      '--light-gray': '#4338CA',
      '--text-primary': '#E0E7FF',
      '--text-secondary': '#C7D2FE',
      '--accent-blue': '#7DD3FC',
      '--accent-yellow': '#F472B6',
    },
  },
  {
    name: 'The Centurion',
    colors: {
      '--cricket-green': '#14B8A6',
      '--pitch-dark': '#F8FAFC',
      '--night-gray': '#FFFFFF',
      '--light-gray': '#F1F5F9',
      '--text-primary': '#0F172A',
      '--text-secondary': '#475569',
      '--accent-blue': '#0EA5E9',
      '--accent-yellow': '#F59E0B',
    },
  },
  {
    name: 'Boundary Gold',
    colors: {
      '--cricket-green': '#CA8A04',
      '--pitch-dark': '#262626',
      '--night-gray': '#404040',
      '--light-gray': '#525252',
      '--text-primary': '#F5F5F5',
      '--text-secondary': '#D4D4D4',
      '--accent-blue': '#60A5FA',
      '--accent-yellow': '#FBBF24',
    },
  },
  {
    name: 'Pitch Perfect',
    colors: {
      '--cricket-green': '#65A30D',
      '--pitch-dark': '#F0FDF4',
      '--night-gray': '#FBFDFB',
      '--light-gray': '#DCFCE7',
      '--text-primary': '#14532D',
      '--text-secondary': '#166534',
      '--accent-blue': '#38BDF8',
      '--accent-yellow': '#FACC15',
    },
  },
  {
    name: 'The Pavilion',
    colors: {
      '--cricket-green': '#BE185D',
      '--pitch-dark': '#4A044E',
      '--night-gray': '#6B21A8',
      '--light-gray': '#7E22CE',
      '--text-primary': '#F3E8FF',
      '--text-secondary': '#E9D5FF',
      '--accent-blue': '#9333EA',
      '--accent-yellow': '#F472B6',
    },
  },
  {
    name: 'Outswing Orange',
    colors: {
      '--cricket-green': '#2563EB',
      '--pitch-dark': '#FFF7ED',
      '--night-gray': '#FFFFFF',
      '--light-gray': '#FFEDD5',
      '--text-primary': '#7C2D12',
      '--text-secondary': '#9A3412',
      '--accent-blue': '#3B82F6',
      '--accent-yellow': '#F97316',
    },
  },
  {
    name: 'White Ball Wonder',
    colors: {
      '--cricket-green': '#10B981',
      '--pitch-dark': '#1F2937',
      '--night-gray': '#374151',
      '--light-gray': '#4B5563',
      '--text-primary': '#FFFFFF',
      '--text-secondary': '#E5E7EB',
      '--accent-blue': '#3B82F6',
      '--accent-yellow': '#F59E0B',
    },
  },
  {
    name: 'The Bouncer',
    colors: {
      '--cricket-green': '#DC2626',
      '--pitch-dark': '#0C0A09',
      '--night-gray': '#1C1917',
      '--light-gray': '#292524',
      '--text-primary': '#FAFAF9',
      '--text-secondary': '#E7E5E4',
      '--accent-blue': '#38BDF8',
      '--accent-yellow': '#FB923C',
    },
  },
  {
    name: 'Leg Spinner Secret',
    colors: {
      '--cricket-green': '#059669',
      '--pitch-dark': '#FDF2F8',
      '--night-gray': '#FFF',
      '--light-gray': '#FCE7F3',
      '--text-primary': '#831843',
      '--text-secondary': '#9D174D',
      '--accent-blue': '#EC4899',
      '--accent-yellow': '#F0ABFC',
    },
  },
  {
    name: 'Cover Drive Cream',
    colors: {
      '--cricket-green': '#047857',
      '--pitch-dark': '#F5F5F4',
      '--night-gray': '#FFFFFF',
      '--light-gray': '#E7E5E4',
      '--text-primary': '#1C1917',
      '--text-secondary': '#44403C',
      '--accent-blue': '#0E7490',
      '--accent-yellow': '#D97706',
    },
  },
  {
    name: 'Champions Trophy',
    colors: {
      '--cricket-green': '#FBBF24',
      '--pitch-dark': '#262626',
      '--night-gray': '#171717',
      '--light-gray': '#404040',
      '--text-primary': '#F5F5F5',
      '--text-secondary': '#A3A3A3',
      '--accent-blue': '#D4D4D4',
      '--accent-yellow': '#FBBF24',
    },
  },
];
