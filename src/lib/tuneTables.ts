import { findChannelByRole } from './channels'
import {
  defaultLoadEdgesForChannel,
  defaultMafVoltageEdges,
  defaultMapPsiEdges,
  defaultRpmEdges,
  type MapAgg,
} from './mapTable'
import type { ChannelRole, ParsedLog } from './types'

export type TuneColorMode = 'heat' | 'diverging'

interface TunePresetDef {
  id: string
  label: string
  xRole: ChannelRole
  yRole: ChannelRole | null
  zRoles: ChannelRole[]
  zIds?: string[]
  defaultAgg: MapAgg
  colorMode: TuneColorMode
  xKind: 'rpm' | 'mafVoltage'
  yKind: 'load' | 'boost' | 'none'
}

export interface ResolvedTuneTable {
  id: string
  label: string
  xChannelId: string
  yChannelId: string | null
  zChannelId: string
  xEdges: number[]
  yEdges: number[]
  defaultAgg: MapAgg
  colorMode: TuneColorMode
  xLabel: string
  yLabel: string
  zLabel: string
  oneDimensional: boolean
}

const PRESETS: TunePresetDef[] = [
  {
    id: 'ignition',
    label: 'Ignition',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['timingAdvance'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'knock',
    label: 'Knock',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['knockRetard'],
    zIds: ['__derived_knock_activity'],
    defaultAgg: 'max',
    colorMode: 'diverging',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'fueling',
    label: 'Fueling',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['afrGas', 'actualLambda'],
    zIds: ['__derived_lambda'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'stft',
    label: 'STFT',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['shortTermFuelTrim'],
    defaultAgg: 'avg',
    colorMode: 'diverging',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'ltft',
    label: 'LTFT',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['longTermFuelTrim'],
    defaultAgg: 'avg',
    colorMode: 'diverging',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'inj-pw',
    label: 'Injector PW',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['injectorPulseWidth'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'maf',
    label: 'MAF',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['mafGps'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'maf-scale',
    label: 'MAF scaling',
    xRole: 'mafVoltage',
    yRole: null,
    zRoles: ['mafGps'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'mafVoltage',
    yKind: 'none',
  },
  {
    id: 'wgdc',
    label: 'Wastegate',
    xRole: 'rpm',
    yRole: 'boost',
    zRoles: ['wgdc'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'boost',
  },
  {
    id: 'vvt-in',
    label: 'Intake cam',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['intakeCamActual'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
  {
    id: 'vvt-ex',
    label: 'Exhaust cam',
    xRole: 'rpm',
    yRole: 'absoluteLoad',
    zRoles: ['exhaustCamActual'],
    defaultAgg: 'avg',
    colorMode: 'heat',
    xKind: 'rpm',
    yKind: 'load',
  },
]

function channelLabel(log: ParsedLog, id: string): string {
  const ch = log.channels.find((c) => c.id === id)
  if (!ch) return id
  return ch.unit ? `${ch.name} (${ch.unit})` : ch.name
}

function pickZ(log: ParsedLog, roles: ChannelRole[], ids?: string[]): string | undefined {
  for (const role of roles) {
    const id = findChannelByRole(log.channels, role)
    if (id) return id
  }
  for (const id of ids ?? []) {
    if (log.channels.some((c) => c.id === id)) return id
  }
  return undefined
}

function xEdgesFor(kind: TunePresetDef['xKind']): number[] {
  if (kind === 'mafVoltage') return defaultMafVoltageEdges()
  return defaultRpmEdges()
}

function yEdgesFor(log: ParsedLog, def: TunePresetDef, yChannelId: string | null): number[] {
  if (def.yKind === 'none') return [0]
  if (def.yKind === 'boost') return defaultMapPsiEdges()
  const yCh = yChannelId ? log.channels.find((c) => c.id === yChannelId) : undefined
  return defaultLoadEdgesForChannel(yCh)
}

/** Presets whose required channels are present in this log. */
export function resolveAvailableTuneTables(log: ParsedLog): ResolvedTuneTable[] {
  const resolved: ResolvedTuneTable[] = []
  for (const def of PRESETS) {
    const xChannelId = findChannelByRole(log.channels, def.xRole)
    const zChannelId = pickZ(log, def.zRoles, def.zIds)
    if (!xChannelId || !zChannelId) continue
    const yChannelId = def.yRole ? (findChannelByRole(log.channels, def.yRole) ?? null) : null
    if (def.yRole && !yChannelId) continue

    const zCh = log.channels.find((c) => c.id === zChannelId)
    resolved.push({
      id: def.id,
      label: def.label,
      xChannelId,
      yChannelId,
      zChannelId,
      xEdges: xEdgesFor(def.xKind),
      yEdges: yEdgesFor(log, def, yChannelId),
      defaultAgg: def.defaultAgg,
      colorMode: def.colorMode,
      xLabel: channelLabel(log, xChannelId),
      yLabel: yChannelId ? channelLabel(log, yChannelId) : def.label,
      zLabel: zCh ? (zCh.unit ? `${zCh.name} (${zCh.unit})` : zCh.name) : def.label,
      oneDimensional: !yChannelId,
    })
  }
  return resolved
}
