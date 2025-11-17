import React from 'react';
import { useApp } from '../contexts/AppContext';
import { themes } from '../themes';
import { Select } from './ui';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useApp();

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="theme-selector" className="text-sm text-text-secondary hidden md:block">Theme</label>
      <Select
        id="theme-selector"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="!py-1 !px-2 text-sm w-32 md:w-36 bg-light-gray border-light-gray"
      >
        {themes.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </Select>
    </div>
  );
};
