// libs/period.js

/** from/to 쿼리를 안전하게 Date로 파싱 */
export function parsePeriod(qs = {}) {
  const fromRaw = qs.from ?? null;
  const toRaw   = qs.to   ?? null;

  const from = fromRaw ? new Date(fromRaw) : null;
  const to   = toRaw   ? new Date(toRaw)   : null;

  return {
    from: from && !isNaN(from.getTime()) ? from : null,
    to:   to   && !isNaN(to.getTime())   ? to   : null,
  };
}

/** '5m', '10m', '1h', '1d' → 초 단위로 변환 (기본 5분) */
export function bucketToSeconds(bucket = '5m') {
  if (typeof bucket !== 'string') return 300;
  const m = bucket.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return 300;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mult = (u === 's') ? 1 : (u === 'm') ? 60 : (u === 'h') ? 3600 : 86400;
  return n * mult;
}

/** (옵션) 기간 WHERE 절 조각이 필요할 때 쓰는 헬퍼 */
export function buildPeriodFilter(query = {}, field = 'created_at') {
  const conds = [];
  if (query.from) conds.push(`${field} >= :from`);
  if (query.to)   conds.push(`${field} <= :to`);
  return conds.length ? `AND ${conds.join(' AND ')}` : '';
}
