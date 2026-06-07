/** Logos/iconos SVG con colores de marca para cada herramienta de acceso remoto */

export function AnyDeskLogo({ size = 32 }: { size?: number }) {
  return <img src="/logo-anydesk.png" alt="AnyDesk" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function TeamViewerLogo({ size = 32 }: { size?: number }) {
  return <img src="/logo-teamviewer.svg" alt="TeamViewer" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function RustDeskLogo({ size = 32 }: { size?: number }) {
  return <img src="/logo-rustdesk.png" alt="RustDesk" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function UltraVNCLogo({ size = 32 }: { size?: number }) {
  return <img src="/logo-ultravnc.png" alt="UltraVNC" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export function RDPLogo({ size = 32 }: { size?: number }) {
  return <img src="/logo-rdp.jpg" alt="RDP" style={{ width: size, height: size, objectFit: 'contain' }} />
}

export type ToolId = 'anydesk' | 'rustdesk' | 'teamviewer' | 'ultravnc' | 'rdp'

export const TOOL_META: Record<ToolId, {
  label: string
  Logo: ({ size }: { size?: number }) => JSX.Element
  color: string
  bgColor: string
  borderColor: string
  requiresId: boolean
  idLabel: string
  passwordLabel?: string
}> = {
  anydesk: {
    label: 'AnyDesk',
    Logo: AnyDeskLogo,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    requiresId: true,
    idLabel: 'AnyDesk ID',
    passwordLabel: 'Contraseña AnyDesk',
  },
  rustdesk: {
    label: 'RustDesk',
    Logo: RustDeskLogo,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    requiresId: true,
    idLabel: 'RustDesk ID',
    passwordLabel: 'Contraseña RustDesk',
  },
  teamviewer: {
    label: 'TeamViewer',
    Logo: TeamViewerLogo,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    requiresId: true,
    idLabel: 'TeamViewer ID',
    passwordLabel: 'Contraseña TV',
  },
  ultravnc: {
    label: 'UltraVNC',
    Logo: UltraVNCLogo,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    requiresId: false,
    idLabel: 'VNC Host',
    passwordLabel: 'Contraseña VNC',
  },
  rdp: {
    label: 'Remote Desktop',
    Logo: RDPLogo,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    requiresId: false,
    idLabel: 'RDP Host',
  },
}
