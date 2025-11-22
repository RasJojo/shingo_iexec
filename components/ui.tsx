
import React, { ReactNode } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon,
  className = '', 
  fullWidth = false,
  ...props 
}) => {
  const baseStyles = "group relative inline-flex items-center justify-center font-sans font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden rounded-lg";
  
  const variants = {
    primary: "bg-white text-black hover:bg-cyan-400 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(0,240,255,0.6)]",
    secondary: "bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md",
    outline: "bg-transparent border border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400",
    ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5 gap-1.5 h-8",
    md: "text-sm px-5 py-2.5 gap-2 h-10",
    lg: "text-base px-8 py-3 gap-2.5 h-12",
    xl: "text-lg px-10 py-4 gap-3 h-14 font-bold tracking-wide"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`} 
      {...props}
    >
      {/* Shimmer effect for primary buttons */}
      {variant === 'primary' && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10 pointer-events-none" />
      )}
      
      <span className="relative z-20 flex items-center gap-2">
        {icon && <span className="w-4 h-4">{icon}</span>}
        {children}
      </span>
    </button>
  );
};

export const Card: React.FC<{ children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }> = ({ 
  children, 
  className = '', 
  hover = false,
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative bg-ash/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden
        ${hover ? 'cursor-pointer group transition-all duration-500 hover:-translate-y-1' : ''}
        ${className}
    `}>
      {/* Holographic Border Gradient */}
      {hover && (
        <div className="absolute inset-0 p-[1px] rounded-xl bg-gradient-to-br from-white/20 via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      
      {/* Hover Glow */}
      {hover && (
         <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      )}

      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
};

export const Badge: React.FC<{ children: ReactNode; variant?: 'cyan' | 'violet' | 'acid' | 'neutral' | 'outline'; size?: 'sm' | 'md' }> = ({ 
  children, 
  variant = 'neutral',
  size = 'md'
}) => {
  const variants = {
    cyan: "text-cyan-400 bg-cyan-900/30 border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(0,240,255,0.2)]",
    violet: "text-violet-400 bg-violet-900/30 border-violet-500/30 shadow-[0_0_15px_-3px_rgba(112,0,255,0.2)]",
    acid: "text-acid-400 bg-acid-900/30 border-acid-500/30",
    neutral: "text-slate-300 bg-white/5 border-white/10",
    outline: "text-slate-400 border border-white/20 bg-transparent"
  };

  const sizes = {
    sm: "text-[10px] px-2 py-0.5 font-bold tracking-wider uppercase",
    md: "text-xs px-3 py-1 font-medium"
  };

  return (
    <span className={`inline-flex items-center justify-center border rounded-full font-mono ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};

export const Metric: React.FC<{ label: string; value: string; trend?: number; trendLabel?: string; subtext?: string; highlight?: boolean }> = ({
  label, value, trend, trendLabel, subtext, highlight = false
}) => (
  <div className="flex flex-col">
    <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider mb-2 flex items-center gap-2">
      {highlight && <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></span>}
      {label}
    </span>
    <div className="flex items-baseline gap-3">
      <span className={`font-display font-medium text-2xl md:text-3xl tracking-tight ${highlight ? 'text-white text-glow' : 'text-slate-200'}`}>
        {value}
      </span>
      {trend !== undefined && (
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${trend >= 0 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-red-500/30 text-red-400 bg-red-500/10'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    {subtext && <span className="text-[10px] text-slate-600 mt-1 font-mono">{subtext}</span>}
  </div>
);

export const SectionHeader: React.FC<{ title: string; subtitle?: string; center?: boolean }> = ({ title, subtitle, center = false }) => (
  <div className={`mb-12 ${center ? 'text-center' : ''}`}>
    <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4 tracking-tighter">{title}</h2>
    {subtitle && <p className="text-slate-400 text-lg max-w-2xl leading-relaxed opacity-80 mx-auto">{subtitle}</p>}
  </div>
);
