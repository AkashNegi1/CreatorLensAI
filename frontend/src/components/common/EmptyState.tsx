type Props = { message?: string };

export function EmptyState({ message = "No data yet" }: Props) {
  return <div className="empty-state">{message}</div>;
}
