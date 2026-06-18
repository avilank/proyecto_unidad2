import { cn } from '@/lib/utils/cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = 'Sin datos',
  className,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-3 font-semibold', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border-soft transition-colors hover:bg-surface-2/50"
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-ink-soft', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
