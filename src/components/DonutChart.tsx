"use client";

type Segment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: Segment[];
  size?: number;
};

export default function DonutChart({ segments, size = 120 }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart-container">
      <div className="donut-chart">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          {total === 0 ? (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="16"
            />
          ) : (
            segments.map((seg) => {
              const pct = seg.value / total;
              const dashArray = `${pct * circumference} ${circumference}`;
              const dashOffset = -offset * circumference;
              offset += pct;
              if (seg.value === 0) return null;
              return (
                <circle
                  key={seg.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="16"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 50 50)"
                />
              );
            })
          )}
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="700"
            fill="#1a1a2e"
          >
            {total}
          </text>
        </svg>
      </div>
      <div className="donut-legend">
        {segments.map((seg) => (
          <div key={seg.label} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="donut-legend-count">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
