const emptyDist = () => ({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });

function finishSummary(dist, sum, count) {
  const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
  return { avg, count, dist, distribution: dist };
}

/** Review docs ya sirf { rating } wale rows */
function ratingSummaryFromReviews(reviews = []) {
  const dist = emptyDist();
  let sum = 0;
  const count = reviews.length;
  for (const r of reviews) {
    const rating = Number(r.rating) || 0;
    sum += rating;
    if (dist[rating] !== undefined) dist[rating] += 1;
  }
  return finishSummary(dist, sum, count);
}

/** Mongo $group buckets: { _id: rating, count } */
function ratingSummaryFromBuckets(buckets = []) {
  const dist = emptyDist();
  let sum = 0;
  let count = 0;
  for (const b of buckets) {
    const rating = Number(b._id) || 0;
    const n = Number(b.count) || 0;
    sum += rating * n;
    count += n;
    if (dist[rating] !== undefined) dist[rating] += n;
  }
  return finishSummary(dist, sum, count);
}

module.exports = { ratingSummaryFromReviews, ratingSummaryFromBuckets };