"use client";

type DataListItem = {
  label: string;
  value: React.ReactNode;
};

type DataListProps = {
  items: DataListItem[];
  columns?: 1 | 2;
};

/**
 * Responsive key-value list for detail pages.
 * Renders as a single or two-column grid of label: value pairs.
 */
export default function DataList({ items, columns = 1 }: DataListProps) {
  return (
    <dl
      className="m-0 p-0 grid gap-0"
      style={{
        gridTemplateColumns: columns === 2 ? "1fr 1fr" : "1fr",
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex justify-between items-baseline px-4 py-2.5 border-b border-[var(--border-light)] last:border-b-0">
          <dt className="text-sm text-[var(--text-secondary)] font-medium">{item.label}</dt>
          <dd className="text-sm font-medium text-right m-0">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
