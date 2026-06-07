import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, Save, RotateCcw, Palette, Shield, Monitor, HardDrive,
  SlidersHorizontal, Building2, Mail, FileText, Skull
} from 'lucide-react'
import { settingsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { PageLoader } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { BranchManager } from '../components/BranchManager'
import { DangerZone } from '../components/DangerZone'
import type { SystemSetting } from '../api/types'
import { DocumentTemplatesPage } from './DocumentTemplatesPage'

const categoryLabels: Record<string, string> = {
  branding: 'Marca e identidad',
  general: 'General',
  catalogos: 'Catálogos',
  security: 'Seguridad',
  sessions: 'Sesiones de soporte',
  storage: 'Almacenamiento',
  email: 'Correo electrónico (SMTP)',
  documentos: 'Módulo de Documentos',
}

const categoryIcons: Record<string, React.ElementType> = {
  branding: Palette,
  general: SlidersHorizontal,
  catalogos: SlidersHorizontal,
  security: Shield,
  sessions: Monitor,
  storage: HardDrive,
  email: Mail,
  documentos: FileText,
}

const categoryOrder = ['branding', 'general', 'catalogos', 'security', 'sessions', 'storage', 'email', 'documentos']

const settingLabels: Record<string, string> = {
  app_name: 'Nombre de la aplicación',
  app_public_url: 'URL pública del panel',
  jwt_expires_minutes: 'Expiración del token JWT (minutos)',
  cors_origins: 'Orígenes CORS permitidos',
  session_min_reason_length: 'Mínimo de caracteres — motivo de sesión',
  session_min_summary_length: 'Mínimo de caracteres — resumen de cierre',
  kb_categories: 'Categorías — Base de Conocimiento (JSON)',
  links_categories: 'Categorías — Links (JSON)',
  vault_categories: 'Categorías — Bóveda de Seguridad (JSON)',
  s3_bucket: 'Bucket S3 / MinIO',
  s3_region: 'Región S3 / MinIO',
  maintenance_mode: 'Modo mantenimiento',
  // Email
  smtp_host: 'Host SMTP',
  smtp_port: 'Puerto SMTP',
  smtp_username: 'Usuario SMTP',
  smtp_password: 'Contraseña SMTP',
  smtp_from_email: 'Correo remitente',
  smtp_tls: 'Usar TLS (STARTTLS)',
  // Documentos
  doc_token_expiry_days: 'Validez del enlace de aprobación (días)',
  doc_download_expiry_hours: 'Ventana de descarga post-aprobación (horas)',
  doc_company_name: 'Nombre empresa en el PDF',
  doc_checklist_items: 'Tareas del checklist diario (JSON)',
  doc_require_tc: 'Requerir aceptación de Términos y Condiciones',
  doc_notify_creator: 'Notificar al creador cuando se responde',
}

function parseValue(val: string): any {
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

function formatValue(val: any): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function inferInputType(val: any): 'text' | 'number' | 'checkbox' | 'textarea' {
  if (typeof val === 'boolean') return 'checkbox'
  if (typeof val === 'number') return 'number'
  if (val && typeof val === 'object') return 'textarea'
  return 'text'
}

export function SettingsPage() {
  const qc = useQueryClient()
  const { user, can } = useAuth()
  const [sp, setSp] = useSearchParams()
  const tabParam = sp.get('tab') || 'general'
  const allowTemplates = can('documents.templates.manage')
  const allowDanger = user?.role === 'admin'

  const allowedTabs = useMemo(() => {
    const base = ['general', 'branches']
    const extra: string[] = []
    if (allowTemplates) extra.push('templates')
    if (allowDanger) extra.push('danger')
    return [...base, ...extra]
  }, [allowTemplates, allowDanger])

  const [activeTab, setActiveTab] = useState<'general' | 'branches' | 'templates' | 'danger'>(
    (allowedTabs.includes(tabParam) ? tabParam : 'general') as any
  )
  const [edits, setEdits] = useState<Record<string, string>>({})

  useEffect(() => {
    const next = (allowedTabs.includes(tabParam) ? tabParam : 'general') as any
    setActiveTab(next)
  }, [tabParam, allowedTabs.join('|')])

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list().then((r) => r.data),
  })

  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      settingsApi.update(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  if (isLoading) return <PageLoader />

  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, SystemSetting[]>)

  const handleChange = (key: string, val: string) => {
    setEdits((prev) => ({ ...prev, [key]: val }))
  }

  const handleSave = (key: string, currentValue: string) => {
    const raw = edits[key] !== undefined ? edits[key] : currentValue
    const parsed = parseValue(raw)
    update.mutate({ key, value: parsed }, {
      onSuccess: () => {
        setEdits((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      },
    })
  }

  const handleReset = (key: string) => {
    setEdits((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const tabs = [
    { id: 'general' as const, label: 'Sistema', icon: Settings, show: true },
    { id: 'branches' as const, label: 'Sucursales', icon: Building2, show: true },
    { id: 'templates' as const, label: 'Plantillas', icon: FileText, show: allowTemplates },
    { id: 'danger' as const, label: 'Zona de Peligro', icon: Skull, show: allowDanger },
  ].filter(t => t.show)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configuraciones"
        subtitle="Personalizá el comportamiento del sistema y gestioná tus sucursales"
        icon={<Settings size={16} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-panel border border-border rounded-xl p-3 h-fit sticky top-6">
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSp((prev) => {
                      const next = new URLSearchParams(prev)
                      next.set('tab', tab.id)
                      return next
                    })
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-sans transition-all duration-150 ${
                    tab.id === 'danger'
                      ? active
                        ? 'bg-red-900/30 text-red-300 border border-red-700/40'
                        : 'text-red-500/70 hover:text-red-400 hover:bg-red-900/20 border border-transparent'
                      : active
                        ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-cyan-glow'
                        : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent'
                  }`}
                >
                  <Icon size={15} />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <section>
          <AnimatePresence mode="wait">
            {activeTab === 'general' ? (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {categoryOrder.map((cat) => {
                  const catSettings = grouped[cat]
                  if (!catSettings?.length) return null
                  const CatIcon = categoryIcons[cat] || SlidersHorizontal
                  return (
                    <motion.section
                      key={cat}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-md bg-cyan/10 border border-cyan/20 flex items-center justify-center text-cyan">
                          <CatIcon size={14} />
                        </div>
                        <h2 className="font-display font-semibold text-sm text-text-primary tracking-wide">
                          {categoryLabels[cat] || cat}
                        </h2>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      <div className="bg-panel border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                        {catSettings.map((s) => {
                          const parsed = parseValue(s.value)
                          const inputType = inferInputType(parsed)
                          const editedVal = edits[s.key] !== undefined ? edits[s.key] : formatValue(parsed)
                          const hasChanged = edits[s.key] !== undefined
                          const label = settingLabels[s.key] || s.key

                          return (
                            <div key={s.key} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-sans font-medium text-text-primary">{label}</span>
                                  {hasChanged && <Badge variant="amber" dot>Modificado</Badge>}
                                </div>
                                {s.description && (
                                  <p className="text-xs text-text-muted font-sans">{s.description}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-3 min-w-[220px]">
                                {inputType === 'checkbox' ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editedVal === 'true'}
                                      onChange={(e) => handleChange(s.key, e.target.checked ? 'true' : 'false')}
                                      className="w-4 h-4 accent-cyan rounded"
                                    />
                                    <span className="text-sm text-text-secondary font-sans">
                                      {editedVal === 'true' ? 'Activado' : 'Desactivado'}
                                    </span>
                                  </label>
                                ) : inputType === 'textarea' ? (
                                  <Textarea
                                    value={editedVal}
                                    onChange={(e) => handleChange(s.key, e.target.value)}
                                    rows={4}
                                    className="font-mono text-xs min-h-[96px]"
                                  />
                                ) : (
                                  <Input
                                    type={inputType}
                                    value={editedVal}
                                    onChange={(e) => handleChange(s.key, e.target.value)}
                                  />
                                )}

                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(s.key, s.value)}
                                    loading={update.isPending && update.variables?.key === s.key}
                                    className="px-2 py-1"
                                  >
                                    <Save size={13} />
                                  </Button>
                                  {hasChanged && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReset(s.key)}
                                      className="px-2 py-1"
                                    >
                                      <RotateCcw size={13} />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.section>
                  )
                })}
              </motion.div>
            ) : activeTab === 'branches' ? (
              <motion.div
                key="branches"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <BranchManager open={true} onClose={() => {}} inline />
              </motion.div>
            ) : activeTab === 'templates' ? (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentTemplatesPage embedded />
              </motion.div>
            ) : (
              <motion.div
                key="danger"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <DangerZone />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
