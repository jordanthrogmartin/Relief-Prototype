import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary', 
    fullWidth = false, 
    className = '',
    ...props 
}) => {
    const baseStyles = "py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
        primary: "bg-relief-primary text-[#020617] hover:bg-relief-primary/90",
        secondary: "border border-relief-border text-relief-text-secondary hover:bg-white/5",
        danger: "bg-relief-critical/10 border border-relief-critical/20 text-relief-critical hover:bg-relief-critical/20",
        ghost: "bg-transparent text-relief-text-secondary hover:text-relief-text-primary"
    };

    return (
        <button 
            className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};