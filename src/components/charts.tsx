/** Graphiques SVG légers (aucune dépendance) : barres signées et courbe. */
interface Point {
  label: string;
  value: number;
}

const W = 44;
const PAD = { top: 10, bottom: 22 };

function scale(values: number[], height: number) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const h = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((max - v) / span) * h;
  return { y, zero: y(0) };
}

const shortMonth = (m: string): string => (m.length === 7 ? `${m.slice(5)}/${m.slice(2, 4)}` : m);

export function BarChart({ points, format, height = 150 }: { points: Point[]; format: (v: number) => string; height?: number }) {
  const { y, zero } = scale(points.map((p) => p.value), height);
  const width = Math.max(points.length * W, 120);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Graphique en barres" className="max-w-none">
        <line x1="0" x2={width} y1={zero} y2={zero} className="stroke-slate-300" strokeWidth="1" />
        {points.map((p, i) => {
          const top = Math.min(y(p.value), zero);
          const h = Math.max(Math.abs(y(p.value) - zero), p.value === 0 ? 0 : 1);
          return (
            <g key={p.label}>
              <rect x={i * W + 8} y={top} width={W - 16} height={h} rx="2" className={p.value >= 0 ? 'fill-gain' : 'fill-loss'}>
                <title>{`${p.label} : ${format(p.value)}`}</title>
              </rect>
              <text x={i * W + W / 2} y={height - 6} textAnchor="middle" className="fill-slate-500" fontSize="9">
                {shortMonth(p.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function LineChart({ points, format, height = 150 }: { points: Point[]; format: (v: number) => string; height?: number }) {
  const { y, zero } = scale(points.map((p) => p.value), height);
  const width = Math.max(points.length * W, 120);
  const xs = (i: number) => i * W + W / 2;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${y(p.value)}`).join(' ');
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Courbe" className="max-w-none">
        <line x1="0" x2={width} y1={zero} y2={zero} className="stroke-slate-300" strokeWidth="1" />
        <path d={d} fill="none" className="stroke-navy-700" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={xs(i)} cy={y(p.value)} r="3" className="fill-navy-700">
              <title>{`${p.label} : ${format(p.value)}`}</title>
            </circle>
            <text x={xs(i)} y={height - 6} textAnchor="middle" className="fill-slate-500" fontSize="9">
              {shortMonth(p.label)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function ProgressBar({ pct, tone = 'navy' }: { pct: number; tone?: 'navy' | 'gain' | 'warn' | 'loss' }) {
  const color = { navy: 'bg-navy-700', gain: 'bg-gain', warn: 'bg-warn', loss: 'bg-loss' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
