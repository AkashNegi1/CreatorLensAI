const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error ?? err.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
