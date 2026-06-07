type Variant = 'cyan' | 'green' | 'amber' | 'red' | 'muted'

const styles: Record<Variant, string> = {
  cyan: 'bg-cyan-glow text-cyan border border-cyan/30',
  green: 'bg-green-op/10 text-green-op border border-green-op/30',
  amber: 'bg-amber-op/10 text-amber-op border border-amber-op/30',
  red: 'bg-red-op/10 text-red-op border border-red-op/30',
  muted: 'bg-elevated text-text-secondary border border-border',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Badge({ variant = 'muted', children, dot, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium ${styles[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${variant === 'cyan' ? 'bg-cyan animate-pulse' : variant === 'green' ? 'bg-green-op animate-pulse' : variant === 'amber' ? 'bg-amber-op' : variant === 'red' ? 'bg-red-op' : 'bg-text-secondary'}`} />
      )}
      {children}
    </span>
  )
}
