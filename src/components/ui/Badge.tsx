import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'red' | 'yellow' | 'zinc' | 'sky';
  className?: string;
}

const variantClasses = {
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  red: 'bg-red-500/10 text-red-400 ring-red-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20',
  zinc: 'bg-zinc-800 text-zinc-400 ring-zinc-700',
  sky: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
};

const Badge = ({ children, variant = 'zinc', className }: BadgeProps) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
      variantClasses[variant],
      className
    )}
  >
    {children}
  </span>
);

export default Badge;
