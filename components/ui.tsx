

import React, { ReactNode } from 'react';

// FIX: Add size prop to ButtonProps to allow for different button sizes.
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

// FIX: Update Button component to handle the new size prop and apply corresponding CSS classes.
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', children, className, ...props }) => {
  const baseClasses = 'rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-pitch-dark transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-cricket-green text-white hover:bg-green-600 focus:ring-cricket-green',
    secondary: 'bg-light-gray text-text-primary hover:bg-gray-600 focus:ring-light-gray',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
    ghost: 'bg-transparent text-text-primary hover:bg-light-gray focus:ring-light-gray'
  };
  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// FIX: Updated CardProps to extend React.HTMLAttributes<HTMLDivElement> to allow passing standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div className={`bg-night-gray p-6 rounded-lg shadow-lg border border-light-gray ${className}`} {...props}>
      {children}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

// FIX: The Input component was not forwarding refs, causing an error when used with a ref in App.tsx. It is now wrapped in React.forwardRef to correctly pass the ref to the underlying input element.
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, ...props }, ref) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>}
        <input
            id={id}
            ref={ref}
            className="w-full bg-light-gray border border-gray-600 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cricket-green focus:border-transparent placeholder-text-secondary"
            {...props}
        />
    </div>
));
Input.displayName = 'Input';


interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    children: ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, id, children, ...props }) => (
    <div>
        {label && <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1">{label}</label>}
        <select
            id={id}
            className="w-full bg-light-gray border border-gray-600 rounded-md py-2 px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cricket-green focus:border-transparent"
            {...props}
        >
            {children}
        </select>
    </div>
);


interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '3xl' | '5xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '3xl': 'max-w-3xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
      <div className={`bg-night-gray rounded-lg shadow-xl w-full ${sizeClasses[size]} border border-light-gray flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-light-gray">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          {onClose && <button onClick={onClose} className="text-text-secondary hover:text-text-primary">&times;</button>}
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};