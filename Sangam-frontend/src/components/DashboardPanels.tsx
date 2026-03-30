/**
 * Shared UI components used across dashboard pages.
 * Most page-specific components are now co-located in their page files.
 */

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}
