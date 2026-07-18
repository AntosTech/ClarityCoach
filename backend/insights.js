// Pure functions for computing progress-view statistics from a user's
// submission history. No I/O, no network calls — kept separate from
// server.js specifically so they're easy to unit test without mocking
// Express, Supabase, or Azure OpenAI.

export const SCORE_DIMENSIONS = [
  { key: "clarity_score", label: "Clarity" },
  { key: "politeness_score", label: "Politeness" },
  { key: "professionalism_score", label: "Professionalism" }
];

export function average(items, key) {
  return items.reduce((sum, item) => sum + item[key], 0) / items.length;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// Compares a "recent" slice of a user's history against the slice before
// it, per score dimension, so we can say something like "politeness is
// down 1.3 points over your last 5 messages" instead of just an average.
export function computeTrend(submissions) {
  const total = submissions.length;
  const recentSize = total >= 6 ? 5 : Math.ceil(total / 2);
  const recent = submissions.slice(-recentSize);
  const previous = submissions.slice(0, total - recentSize);

  const trend = {};
  for (const { key, label } of SCORE_DIMENSIONS) {
    const recentAvg = round1(average(recent, key));
    const previousAvg = previous.length ? round1(average(previous, key)) : null;
    trend[label] = {
      recentAvg,
      previousAvg,
      delta: previousAvg !== null ? round1(recentAvg - previousAvg) : null
    };
  }
  return trend;
}

export function computeOverallAverages(submissions) {
  const overall = {};
  for (const { key, label } of SCORE_DIMENSIONS) {
    overall[label] = round1(average(submissions, key));
  }
  return overall;
}

export function findWeakestDimension(overallAverages) {
  return Object.entries(overallAverages).sort((a, b) => a[1] - b[1])[0][0];
}
