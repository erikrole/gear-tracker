/**
 * Shared category dropdown with hierarchical optgroup rendering.
 * Used by items list (create form) and item detail (category field).
 */

type CategoryOption = { id: string; name: string; parentId: string | null };

export function CategorySelect({
  categories,
  name,
  value,
  onChange,
  placeholder = "Category",
  style,
  required,
}: {
  categories: CategoryOption[];
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      style={style}
      required={required}
    >
      <option value="">{placeholder}</option>
      {categories.filter((c) => !c.parentId).map((parent) => {
        const children = categories.filter((c) => c.parentId === parent.id);
        return (
          <optgroup key={parent.id} label={parent.name}>
            {children.length === 0
              ? <option value={parent.id}>{parent.name}</option>
              : children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))
            }
          </optgroup>
        );
      })}
    </select>
  );
}
