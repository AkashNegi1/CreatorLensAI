type Props = { message?: string };

export function LoadingState({ message = "Loading..." }: Props) {
  return <div className="loading-state">{message}</div>;
}
