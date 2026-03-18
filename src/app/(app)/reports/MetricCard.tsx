"use client";

type MetricCardProps = {
  label: string;
  value: number | string;
  color?: string;
  badge?: { text: string; className: string };
};

export default function MetricCard({ label, value, color, badge }: MetricCardProps) {
  return (
    <div className="card p-16 text-center">
      <div className="metric-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-sm text-muted">
        {badge ? (
          <span className={`badge ${badge.className}`}>{badge.text}</span>
        ) : (
          label
        )}
      </div>
    </div>
  );
}
