import { cellColor, type MapAgg, type MapTableResult } from '../../lib/mapTable'

export function formatMapEdge(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  const rounded = Math.round(n * 1e5) / 1e5
  const s = rounded.toFixed(5).replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}

export function formatMapCell(v: number | null, agg: MapAgg): string {
  if (v == null) return ''
  if (agg === 'count') return String(Math.round(v))
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

export interface MapHoverInfo {
  x: number
  y: number
  value: number | null
  count: number
}

interface Props {
  result: MapTableResult
  agg: MapAgg
  colorMode: 'heat' | 'diverging'
  xLabel: string
  yLabel: string
  oneDimensional?: boolean
  onHover?: (info: MapHoverInfo | null) => void
}

export function MapGrid({
  result,
  agg,
  colorMode,
  xLabel,
  yLabel,
  oneDimensional = false,
  onHover,
}: Props) {
  return (
    <div className="map-scroll">
      <table className="map-table">
        <thead>
          <tr>
            <th className="map-corner">
              {yLabel}＼{xLabel}
            </th>
            {result.xEdges.map((site, i) => (
              <th key={i}>{formatMapEdge(site)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.values.map((row, yi) => (
            <tr key={yi}>
              <th>{oneDimensional ? yLabel : formatMapEdge(result.yEdges[yi])}</th>
              {row.map((value, xi) => (
                <td
                  key={xi}
                  style={{
                    background: cellColor(value, result.globalMin, result.globalMax, colorMode),
                  }}
                  className={value == null ? 'empty' : ''}
                  onMouseEnter={() =>
                    onHover?.({
                      x: result.xEdges[xi],
                      y: result.yEdges[yi],
                      value: result.values[yi][xi],
                      count: result.cells[yi][xi].count,
                    })
                  }
                  onMouseLeave={() => onHover?.(null)}
                >
                  {formatMapCell(value, agg)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
