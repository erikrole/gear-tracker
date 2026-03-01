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
      className="data-list"
      style={{
        display: "grid",
        gridTemplateColumns: columns === 2 ? "1fr 1fr" : "1fr",
        gap: 0,
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="data-list-row">
          <dt className="data-list-label">{item.label}</dt>
          <dd className="data-list-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
