import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BookOpen, Plus, Search, Tag, Pencil, Trash2,
  X, Download, Eye, FolderOpen, AlertTriangle
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import MDEditor from '@uiw/react-md-editor'
import { kbApi, api, settingsApi } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, FormField } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import type { KBArticle, KBIn } from '../api/types'
import { useAuth } from '../context/AuthContext'

/* ─── Article card ─── */
function ArticleCard({ article, onView, onEdit, onDelete }: {
  article: KBArticle; onView: () => void; onEdit: () => void; onDelete: () => void
}) {
  const { user } = useAuth()
  const tags = article.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-panel border border-border rounded-lg overflow-hidden hover:border-border-bright transition-colors"
    >
      <div className="flex items-center justify-between px-5 py-4 gap-4">
        <button onClick={onView} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-cyan/10 border border-cyan/20 flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm text-text-primary tracking-wide truncate">{article.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="muted" className="text-[10px]">{article.category}</Badge>
              <span className="font-mono text-[10px] text-text-muted">
                {new Date(article.updated_at).toLocaleDateString('es-MX')}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {tags.length > 0 && (
            <div className="hidden sm:flex gap-1.5 flex-wrap">
              {tags.slice(0, 3).map(t => (
                <span key={t} className="flex items-center gap-1 bg-cyan/10 text-cyan border border-cyan/20 rounded px-1.5 py-0.5 text-[10px] font-mono">
                  <Tag size={9} />{t}
                </span>
              ))}
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={onView}><Eye size={13} />Ver</Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={13} /></Button>
              <Button size="sm" variant="ghost" className="hover:text-red-op" onClick={onDelete}><Trash2 size={13} /></Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Article form ─── */
function ArticleForm({ initial, onSave, onCancel, loading, categories }: {
  initial?: Partial<KBIn>; onSave: (d: KBIn) => void; onCancel: () => void; loading: boolean; categories: string[]
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content_md ?? '')
  const [tags, setTags] = useState(initial?.tags ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'general')

  const handleImageUpload = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/kb/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  }, [])

  return (
    <div className="space-y-4">
      <FormField label="Título *">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del artículo" required />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Categoría">
          <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="general" list="kb-categories" />
          <datalist id="kb-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </FormField>
        <FormField label="Etiquetas">
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="red, vpn, windows" />
        </FormField>
      </div>
      <div data-color-mode="dark">
        <label className="block text-xs font-mono text-text-secondary uppercase tracking-widest mb-1.5">Contenido (Markdown) *</label>
        <MDEditor
          value={content}
          onChange={(v) => setContent(v || '')}
          height={400}
          {...({ onImageUpload: handleImageUpload } as any)}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={() => onSave({ title, content_md: content, tags: tags || undefined, category })}
          loading={loading}
          className="flex-1"
        >
          Guardar artículo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}

/* ─── Preview modal ─── */
function PreviewModal({ article, onClose, onEdit, onDelete }: {
  article: KBArticle; onClose: () => void; onEdit: () => void; onDelete: () => void
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'
  const tags = article.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []

  const handleDownload = () => {
    const blob = new Blob(
      [`# ${article.title}\n\nCategoría: ${article.category}\nTags: ${article.tags || '—'}\n\n---\n\n${article.content_md}`],
      { type: 'text/markdown' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${article.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-xl text-text-primary tracking-wide">{article.title}</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="cyan">{article.category}</Badge>
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 bg-cyan/10 text-cyan border border-cyan/20 rounded px-1.5 py-0.5 text-[10px] font-mono">
                <Tag size={9} />{t}
              </span>
            ))}
            <span className="font-mono text-[10px] text-text-muted">
              {new Date(article.updated_at).toLocaleDateString('es-MX')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={handleDownload}><Download size={14} />Descargar</Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { onClose(); onEdit(); }}><Pencil size={14} />Editar</Button>
              <Button size="sm" variant="ghost" className="hover:text-red-op" onClick={() => { onClose(); onDelete(); }}><Trash2 size={14} />Eliminar</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}><X size={14} /></Button>
        </div>
      </div>

      <div className="bg-elevated border border-border rounded-lg px-6 py-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <div className="prose prose-invert max-w-none
          prose-headings:font-display prose-headings:text-text-primary prose-headings:tracking-wide
          prose-p:text-text-secondary prose-p:font-sans
          prose-code:text-cyan prose-code:bg-panel prose-code:px-1 prose-code:rounded prose-code:font-mono
          prose-pre:bg-panel prose-pre:border prose-pre:border-border prose-pre:rounded
          prose-a:text-cyan prose-a:no-underline hover:prose-a:underline
          prose-strong:text-text-primary
          prose-li:text-text-secondary prose-li:font-sans
          prose-img:rounded-lg prose-img:border prose-img:border-border
          prose-table:border prose-table:border-border prose-th:bg-elevated prose-th:text-text-primary prose-td:text-text-secondary
        ">
          <ReactMarkdown>{article.content_md}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

/* ─── Page ─── */
export function KBPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<KBArticle | null>(null)
  const [previewing, setPreviewing] = useState<KBArticle | null>(null)
  const [deleting, setDeleting] = useState<KBArticle | null>(null)
  const [search, setSearch] = useState('')

  const { data: articles = [], isLoading } = useQuery({ queryKey: ['kb'], queryFn: () => kbApi.list().then(r => r.data) })
  const { data: categoriesValue } = useQuery({
    queryKey: ['public-setting', 'kb_categories'],
    queryFn: () => settingsApi.getPublic('kb_categories').then((r) => r.data.value),
  })

  const categories = Array.isArray(categoriesValue) && categoriesValue.every((x) => typeof x === 'string')
    ? (categoriesValue as string[])
    : ['general', 'redes', 'vpn', 'windows', 'linux', 'hardware', 'procedimientos', 'seguridad']

  const create = useMutation({
    mutationFn: kbApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb'] }); setShowCreate(false) },
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<KBIn> }) => kbApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb'] }); setEditing(null) },
  })
  const del = useMutation({
    mutationFn: kbApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb'] }); setDeleting(null); setPreviewing(null) },
    onError: (err: any) => {},
  })

  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor'
  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? '').toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase()) ||
    a.content_md.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, a) => {
    const cat = a.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(a)
    return acc
  }, {} as Record<string, KBArticle[]>)
  const categoryOrder = Object.keys(grouped).sort()

  if (isLoading) return <PageLoader />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Base de Conocimiento"
        subtitle={`${articles.length} artículos${search ? ` · ${filtered.length} coincidencias` : ''}`}
        icon={<BookOpen size={16} />}
        action={isAdmin ? <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} />Nuevo artículo</Button> : undefined}
      />

      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título, etiquetas, categoría o contenido..."
          className="w-full bg-panel border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary font-sans placeholder:text-text-muted focus:outline-none focus:border-cyan/60 focus:ring-1 focus:ring-cyan/20 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen size={36} className="text-text-muted mx-auto mb-3" />
          <p className="font-sans text-sm text-text-secondary">
            {search ? 'No hay artículos que coincidan con tu búsqueda.' : 'No hay artículos aún.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoryOrder.map((cat, gi) => (
            <motion.section key={cat} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.06 }}>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={13} className="text-cyan" />
                <h2 className="font-mono text-xs text-text-secondary uppercase tracking-widest">{cat}</h2>
                <span className="font-mono text-[10px] text-text-muted">({grouped[cat].length})</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-3">
                {grouped[cat].map(a => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    onView={() => setPreviewing(a)}
                    onEdit={() => setEditing(a)}
                    onDelete={() => setDeleting(a)}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      {/* Create / Edit */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Artículo" width="max-w-4xl">
        <ArticleForm onSave={(d) => create.mutate(d)} onCancel={() => setShowCreate(false)} loading={create.isPending} categories={categories} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Artículo" width="max-w-4xl">
        {editing && (
          <ArticleForm
            initial={{ ...editing, tags: editing.tags ?? undefined }}
            onSave={(d) => update.mutate({ id: editing.id, data: d })}
            onCancel={() => setEditing(null)}
            loading={update.isPending}
            categories={categories}
          />
        )}
      </Modal>

      {/* Preview */}
      <Modal open={!!previewing} onClose={() => setPreviewing(null)} title="" width="max-w-4xl">
        {previewing && (
          <PreviewModal
            article={previewing}
            onClose={() => setPreviewing(null)}
            onEdit={() => setEditing(previewing)}
            onDelete={() => setDeleting(previewing)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar eliminación">
        {deleting && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-op/10 border border-red-op/20 rounded-lg px-4 py-3">
              <AlertTriangle size={18} className="text-red-op flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-primary font-medium">¿Eliminar artículo?</p>
                <p className="text-xs text-text-secondary mt-1">
                  Vas a eliminar <strong className="text-text-primary">"{deleting.title}"</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            {del.error && (
              <div className="text-xs text-red-op bg-red-op/10 border border-red-op/20 rounded px-3 py-2 space-y-1">
                <p className="font-medium">Error al eliminar</p>
                <p className="opacity-80">
                  Status: {(del.error as any)?.response?.status ?? '—'}<br/>
                  {(del.error as any)?.response?.data?.detail ?? (del.error as any)?.message ?? 'Error desconocido'}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="danger" onClick={() => del.mutate(deleting.id)} loading={del.isPending} className="flex-1">
                <Trash2 size={14} />Sí, eliminar
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={del.isPending}>Cancelar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
