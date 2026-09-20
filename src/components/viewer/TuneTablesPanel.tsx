import { useEffect, useMemo, useState } from 'react'
import { buildMapTable, formatEdgesForInput, type MapAgg } from '../../lib/mapTable'
import { resolveAvailableTuneTables } from '../../lib/tuneTables'
import type { ParsedLog, TimeRange } from '../../lib/types'
import { formatMapCell, formatMapEdge, MapGrid, type MapHoverInfo } from './MapGrid'

interface Props {
  log: ParsedLog
  range: TimeRange | null
}

export function TuneTablesPanel({ log, range }: Props) {
  const tables = useMemo(() => resolveAvailableTuneTables(log), [log])
  const [activeId, setActiveId] = useState(tables[0]?.id ?? '')
  const [agg, setAgg] = useState<MapAgg>(tables[0]?.defaultAgg ?? 'avg')
  const [hover, setHover] = useState<MapHoverInfo | null>(null)

  const active = tables.find((t) => t.id === activeId) ?? tables[0] ?? null

  useEffect(() => {
    if (tables.length === 0) {
      setActiveId('')
      return
    }
    if (!tables.some((t) => t.id === activeId)) {
      setActiveId(tables[0].id)
      setAgg(tables[0].defaultAgg)
    }
  }, [tables, activeId])

  const result = useMemo(() => {
    if (!active) return null
    return buildMapTable(log, {
      xChannelId: active.xChannelId,
      yChannelId: active.yChannelId,
      zChannelId: active.zChannelId,
      xEdges: active.xEdges,
      yEdges: active.yEdges,
      agg,
      range,
    })
  }, [log, active, agg, range])

  if (!active) {
    return (
      <div className="map-table-panel">
        <div className="panel-header">Implied tune tables</div>
        <p className="settings-card-note">
          This log does not include the channels needed to reconstruct ignition, fueling, or MAF
          tables. MAF needs both MAF voltage (V) and MAF airflow (g/s).
        </p>
      </div>
    )
  }

  return (
    <div className="map-table-panel">
      <div className="panel-header">Implied tune tables</div>
      <p className="tune-note">
        Logged samples binned onto typical ECU sites — not the ROM map. Select a pull on Charts to
        limit hits.
      </p>
      <div className="tune-tabs" role="tablist" aria-label="Implied tables">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active.id}
            className={t.id === active.id ? 'active' : ''}
            onClick={() => {
              setActiveId(t.id)
              setAgg(t.defaultAgg)
              setHover(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="map-controls">
        <label>
          Aggregate
          <select value={agg} onChange={(e) => setAgg(e.target.value as MapAgg)}>
            <option value="avg">Average</option>
            <option value="max">Max</option>
            <option value="min">Min</option>
            <option value="count">Hit count</option>
          </select>
        </label>
      </div>
      <div className="map-edge-editors tune-sites">
        <label>
          {active.xLabel}
          <input readOnly value={formatEdgesForInput(active.xEdges)} />
        </label>
        {!active.oneDimensional && (
          <label>
            {active.yLabel}
            <input readOnly value={formatEdgesForInput(active.yEdges)} />
          </label>
        )}
      </div>
      <div className="map-meta">
        {active.zLabel}
        {' · '}
        hits={result?.hitCount ?? 0}
        {range ? ` · pull ${range.start.toFixed(2)}–${range.end.toFixed(2)}s` : ' · full log'}
        {hover && (
          <>
            {' '}
            · {formatMapEdge(hover.x)}
            {active.oneDimensional ? '' : ` × ${formatMapEdge(hover.y)}`}:{' '}
            {formatMapCell(hover.value, agg)}
            {agg !== 'count' ? ` (n=${hover.count})` : ''}
          </>
        )}
      </div>
      {result && (
        <MapGrid
          result={result}
          agg={agg}
          colorMode={active.colorMode}
          xLabel={active.xLabel}
          yLabel={active.oneDimensional ? active.zLabel : active.yLabel}
          oneDimensional={active.oneDimensional}
          onHover={setHover}
        />
      )}
    </div>
  )
}
