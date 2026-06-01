type Props = { message: string };

export function ErrorBox({ message }: Props) {
  return <div className="error-box">{message}</div>;
}
