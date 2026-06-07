import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Dialog.Overlay asChild>
                <motion.div
                  className="absolute inset-0 bg-base/80 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>

              <Dialog.Content asChild>
                <motion.div
                  className={`relative w-full ${width} bg-panel border border-border rounded-lg shadow-2xl shadow-black/60 focus:outline-none`}
                  initial={{ scale: 0.95, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 12 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <Dialog.Title className="font-display text-base font-semibold text-text-primary tracking-wide">
                      {title}
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-elevated">
                        <X size={16} />
                      </button>
                    </Dialog.Close>
                  </div>
                  <div className="p-6">{children}</div>
                </motion.div>
              </Dialog.Content>
            </motion.div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
