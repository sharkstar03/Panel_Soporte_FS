import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link2, Plus, ExternalLink, Trash2, FolderOpen } from 'lucide-react'
import { linksApi, settingsApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import type { LinkIn } from '../api/types'
import { useAuth } from '../context/AuthContext'

export function LinksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('general')

  const { data: links = [], isLoading } = useQuery({ queryKey: ['links'], queryFn: () => linksApi.list().then(r => r.data) })
  const { data: categoriesValue } = useQuery({
    queryKey: ['public-setting', 'links_categories'],
    queryFn: () => settingsApi.getPublic('links_categories').then((r) => r.data.value),
  })

  const categories = Array.isArray(categoriesValue) && categoriesValue.every((x) => typeof x === 'string')
    ? (categoriesValue as string[])
    : ['general']

  const create = useMutation({
    mutationFn: (d: LinkIn) => linksApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['links'] }); setShowCreate(false); setTitle(''); setUrl(''); setCategory('general') },
  })
  const del = useMutation({ mutationFn: linksApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['links'] }) })

  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'

  const grouped = links.reduce((acc, link) => {
    const cat = link.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(link)
    return acc
  }, {} as Record<string, typeof links>)

  if (isLoading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Links"
        subtitle="Accesos directos del equipo"
        icon={<Link2 size={16} />}
        action={isAdmin ? <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nuevo link</Button> : undefined}
      />

      {links.length === 0 ? (
        <div className="py-16 text-center">
          <Link2 size={36} className="text-text-muted mx-auto mb-3" />
          <p className="font-sans text-sm text-text-secondary">No hay links registrados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catLinks], gi) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.08 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={13} className="text-cyan" />
                <h2 className="font-mono text-xs text-text-secondary uppercase tracking-wide">{cat}</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catLinks.map((link, i) => (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: gi * 0.08 + i * 0.04 }}
                    className="group flex items-center justify-between bg-panel border border-border rounded-lg px-4 py-3 hover:border-cyan/40 hover:shadow-cyan-glow transition-all"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-8 h-8 rounded bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0">
                        <ExternalLink size={13} className="text-cyan" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-sans text-sm text-text-primary group-hover:text-cyan transition-colors truncate">{link.title}</p>
                        <p className="font-mono text-[10px] text-text-muted truncate">{link.url}</p>
                      </div>
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => del.mutate(link.id)}
                        className="ml-3 text-text-muted hover:text-red-op transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Link">
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate({ title, url, category }) }}
          className="space-y-4"
        >
          <FormField label="Título *">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Panel de monitoreo" required />
          </FormField>
          <FormField label="URL *">
            <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." required />
          </FormField>
          <FormField label="Categoría">
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="general" list="links-categories" />
            <datalist id="links-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={create.isPending} className="flex-1">Guardar link</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
