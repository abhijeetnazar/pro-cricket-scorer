
import React from 'react';

// Icons have been converted to theme-aware, inline SVGs for performance and offline capability.
// They use `currentColor` to adapt to the active theme's text color.

export const CricketBallIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src="https://i.ibb.co/yn15CGbs/Whats-App-Image-2025-11-01-at-12-30-33.jpg" 
    alt="Cricket Ball" 
    className={className} 
  />
);

export const CricketBatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src="https://i.ibb.co/yn15CGbs/Whats-App-Image-2025-11-01-at-12-30-33.jpg" 
    alt="Cricket Ball" 
    className={className} 
  />
);

export const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 20h5v-2a3 3 0 00-5.356-2.356M12 21a9 9 0 110-18 9 9 0 010 18zm0 0a9 9 0 100-18 9 9 0 000 18z' /%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 12a3 3 0 100-6 3 3 0 000 6zM2 20h5v-2a3 3 0 015.356-2.356' /%3e%3c/svg%3e" alt="Users" className={className} />
);

export const UserPlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' /%3e%3c/svg%3e" alt="Add User" className={className} />
);

export const TrophyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z' /%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 19V9a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2z' /%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 21V9' /%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 21V9' /%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13h14' /%3e%3c/svg%3e" alt="Trophy" className={className} />
);

export const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' /%3e%3c/svg%3e" alt="Add" className={className} />
);

export const LogoutIcon: React.FC<{ className?: string }> = ({ className }) => (
    <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' /%3e%3c/svg%3e" alt="Logout" className={className} />
);

export const CloudUploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' /%3e%3c/svg%3e" alt="Upload" className={className} />
);

export const RotateCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M3 2v6h6'/%3e%3cpath d='M3 13a9 9 0 1 0 3-7.7L3 8'/%3e%3c/svg%3e" alt="Undo" className={className} />
);

export const Trash2Icon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M3 6h18'/%3e%3cpath d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/%3e%3cline x1='10' y1='11' x2='10' y2='17'/%3e%3cline x1='14' y1='11' x2='14' y2='17'/%3e%3c/svg%3e" alt="Delete" className={className} />
);

export const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 6h16M4 12h16M4 18h16' /%3e%3c/svg%3e" alt="Menu" className={className} />
);

export const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' /%3e%3c/svg%3e" alt="Close" className={className} />
);

export const SwapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M8 7l-4 4 4 4'/%3e%3cpath d='M4 11h16'/%3e%3cpath d='M16 17l4-4-4-4'/%3e%3c/svg%3e" alt="Swap" className={className} />
);

export const BarChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cline x1='12' y1='20' x2='12' y2='10'/%3e%3cline x1='18' y1='20' x2='18' y2='4'/%3e%3cline x1='6' y1='20' x2='6' y2='16'/%3e%3c/svg%3e" alt="Stats" className={className} />
);

export const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/%3e%3cpath d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/%3e%3c/svg%3e" alt="Edit" className={className} />
);

export const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m18 15-6-6-6 6'/%3e%3c/svg%3e" alt="Sort Ascending" className={className} />
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e" alt="Sort Descending" className={className} />
);

export const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cellipse cx='12' cy='5' rx='9' ry='3'/%3e%3cpath d='M21 12c0 1.66-4 3-9 3s-9-1.34-9-3'/%3e%3cpath d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'/%3e%3c/svg%3e" alt="Database" className={className} />
);
