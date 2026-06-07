import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: ReactNode
}

export function PageHeader({ title, subtitle, action, icon }: Props) {
  return (
    <motion.div
      className="flex items-start justify-between mb-6"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display font-bold text-xl text-text-primary tracking-wide">{title}</h1>
          {subtitle && <p className="text-sm font-sans text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  )
}
