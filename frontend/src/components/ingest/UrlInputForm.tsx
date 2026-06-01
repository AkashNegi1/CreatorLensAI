import { useState } from "react";

type Props = {
  loading: boolean;
  onSubmit: (urlA: string, urlB: string) => void;
};

export function UrlInputForm({ loading, onSubmit }: Props) {
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA.trim() || !urlB.trim()) return;
    onSubmit(urlA.trim(), urlB.trim());
  };

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <div className="url-fields">
        <div className="url-field">
          <label htmlFor="urlA">Video A URL</label>
          <input
            id="urlA"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={urlA}
            onChange={(e) => setUrlA(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="url-field">
          <label htmlFor="urlB">Video B URL</label>
          <input
            id="urlB"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={urlB}
            onChange={(e) => setUrlB(e.target.value)}
            required
            disabled={loading}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
