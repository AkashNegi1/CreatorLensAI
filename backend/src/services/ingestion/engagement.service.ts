function isValidMetric(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function calculateEngagementRate(params: {
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
}): number | null {
  const views = params.views ?? 0;
  if (views <= 0) return null;

  const likes = params.likes;
  const comments = params.comments;

  if (!isValidMetric(likes) || !isValidMetric(comments)) return null;

  const result = Number((((likes + comments) / views) * 100).toFixed(2));

  return Number.isFinite(result) ? result : null;
}
