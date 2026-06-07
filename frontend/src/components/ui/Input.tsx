import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

const base = 'w-full bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary font-sans placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return <input className={`${base} ${className || ''}`} {...rest} />
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  const { className, ...rest } = props
  return <textarea ref={ref} className={`${base} resize-none ${className || ''}`} {...rest} />
})

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props
  return (
    <select className={`${base} cursor-pointer ${className || ''}`} {...rest}>
      {children}
    </select>
  )
}

export function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-mono text-text-secondary uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-red-op">{error}</p>}
    </div>
  )
}
