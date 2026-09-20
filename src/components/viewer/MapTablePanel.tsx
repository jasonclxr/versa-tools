import { useMemo, useState } from 'react'
import {
  buildMapTable,
  defaultLoadEdges,
  defaultLoadEdgesForChannel,
  defaultMapPsiEdges,
  defaultRpmEdges,
  formatEdgesForInput,
  parseEdgeList,
  suggestAxisChannels,
  type MapAgg,
} from '../../lib/mapTable'
import { groupChannels, type ChannelGroup } from '../../lib/channelGroups'
import type { ParsedChannel, ParsedLog, TimeRange } from '../../lib/types'
import { formatMapCell, formatMapEdge, MapGrid, type MapHoverInfo } from './MapGrid'

interface Props {
  log: ParsedLog
  range: TimeRange | null
}

export function MapTablePanel({ log, range }: Props) {
  const suggested = useMemo(() => suggestAxisChannels(log), [log])
  const [xChannelId, setXChannelId] = useState(suggested.xId)
  const [yChannelId, setYChannelId] = useState(suggested.yId)
  const [zChannelId, setZChannelId] = useState(suggested.zId)
  const [agg, setAgg] = useState<MapAgg>('avg')
  const [xEdgesText, setXEdgesText] = useState(() => formatEdgesForInput(defaultRpmEdges()))
  const [yEdgesText, setYEdgesText] = useState(() => {
    const yCh = log.channels.find((c) => c.id === suggested.yId)
    if (yCh?.role === 'absoluteLoad') return formatEdgesForInput(defaultLoadEdgesForChannel(yCh))
    if (yCh?.role === 'boost' || yCh?.name.toLowerCase().includes('boost')) {
      return formatEdgesForInput(defaultMapPsiEdges())
    }
    return formatEdgesForInput(defaultLoadEdges())
  })
  const [hover, setHover] = useState<MapHoverInfo | null>(null)

  const xEdges = useMemo(() => parseEdgeList(xEdgesText) ?? defaultRpmEdges(), [xEdgesText])
  const yEdges = useMemo(() => parseEdgeList(yEdgesText) ?? defaultLoadEdges(), [yEdgesText])

  const result = useMemo(
    () =>
      buildMapTable(log, {
        xChannelId,
        yChannelId,
        zChannelId,
        xEdges,
        yEdges,
        agg,
        range,
      }),
    [log, xChannelId, yChannelId, zChannelId, xEdges, yEdges, agg, range],
  )

  const channelGroups = useMemo(() => groupChannels(log.channels), [log.channels])
  const zCh = log.channels.find((c) => c.id === zChannelId)
  const colorMode =
    zCh?.id.includes('error') ||
    zCh?.role === 'knockRetard' ||
    zCh?.id === '__derived_knock_activity'
      ? 'diverging'
      : 'heat'

  const xLabel = log.channels.find((c) => c.id === xChannelId)?.name ?? 'X'
  const yLabel = log.channels.find((c) => c.id === yChannelId)?.name ?? 'Y'

  return (
    <div className="map-table-panel">
      <div className="panel-header">Map table (Y × X)</div>
      <div className="map-controls">
        <label>
          X (columns)
          <select value={xChannelId} onChange={(e) => setXChannelId(e.target.value)}>
            <ChannelOptions groups={channelGroups} />
          </select>
        </label>
        <label>
          Y (rows)
          <select value={yChannelId} onChange={(e) => setYChannelId(e.target.value)}>
            <ChannelOptions groups={channelGroups} />
          </select>
        </label>
        <label>
          Cell value
          <select value={zChannelId} onChange={(e) => setZChannelId(e.target.value)}>
            <ChannelOptions groups={channelGroups} />
          </select>
        </label>
        <label>
          Aggregate
          <select value={agg} onChange={(e) => setAgg(e.target.value as MapAgg)}>
            <option value="avg">Average</option>
            <option value="max">Max</option>
            <option value="min">Min</option>
            <option value="count">Hit count</option>
          </select>
        </label>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const s = suggestAxisChannels(log)
            setXChannelId(s.xId)
            setYChannelId(s.yId)
            setZChannelId(s.zId)
            setXEdgesText(formatEdgesForInput(defaultRpmEdges()))
            const yCh = log.channels.find((c) => c.id === s.yId)
            setYEdgesText(
              formatEdgesForInput(
                yCh?.role === 'absoluteLoad'
                  ? defaultLoadEdgesForChannel(yCh)
                  : defaultMapPsiEdges(),
              ),
            )
            setAgg('avg')
          }}
        >
          Reset axes
        </button>
      </div>
      <div className="map-edge-editors">
        <label>
          X sites
          <input value={xEdgesText} onChange={(e) => setXEdgesText(e.target.value)} />
        </label>
        <label>
          Y sites
          <input value={yEdgesText} onChange={(e) => setYEdgesText(e.target.value)} />
        </label>
      </div>
      <div className="map-meta">
        hits={result?.hitCount ?? 0}
        {range ? ` · pull ${range.start.toFixed(2)}–${range.end.toFixed(2)}s` : ' · full log'}
        {hover && (
          <>
            {' '}
            · cell X={formatMapEdge(hover.x)}, Y={formatMapEdge(hover.y)}:{' '}
            {formatMapCell(hover.value, agg)}
            {agg !== 'count' ? ` (n=${hover.count})` : ''}
          </>
        )}
      </div>
      {result && (
        <MapGrid
          result={result}
          agg={agg}
          colorMode={colorMode}
          xLabel={xLabel}
          yLabel={yLabel}
          onHover={setHover}
        />
      )}
    </div>
  )
}

function ChannelOptions({ groups }: { groups: ChannelGroup<ParsedChannel>[] }) {
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.unit ? ` (${c.unit})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
