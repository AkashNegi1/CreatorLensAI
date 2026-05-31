export function calculateEngagementRate(params: {
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
}): number | null {
  const views = params.views ?? 0;
  if (views <= 0) return null;

  const comments = params.comments ?? 0;
  const likes = params.likes ?? 0;

  return Number((((likes + comments) / views) * 100).toFixed(2));
}
