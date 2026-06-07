import { ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-cyan text-base font-semibold hover:bg-cyan/80 shadow-cyan-glow hover:shadow-cyan-glow-lg',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent hover:border-border',
  danger: 'bg-red-op/10 text-red-op border border-red-op/30 hover:bg-red-op/20',
  outline: 'bg-transparent text-cyan border border-cyan/40 hover:border-cyan hover:bg-cyan/5',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', children, loading, className = '', disabled, ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded font-sans transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan/40 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
