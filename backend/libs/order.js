// src/libs/order.js

/**
 * 정렬 쿼리 문자열을 안전하게 SQL ORDER BY 절로 변환
 * 예: sort=created_at,desc&sort=name,asc
 * 허용 필드 외의 정렬 요청은 무시
 *
 * @param {string|string[]} sortParam - 요청 쿼리(sort)
 * @param {string[]} allowed - 허용된 컬럼 목록
 * @param {string} defaultOrder - 기본 정렬(SQL 문)
 */
export function buildOrderBy(sortParam, allowed = [], defaultOrder = 'id DESC') {
  const sorts = Array.isArray(sortParam)
    ? sortParam
    : sortParam
    ? [sortParam]
    : [];

  const parts = sorts
    .map((s) => {
      const [field, dirRaw] = String(s).split(',');
      if (!allowed.includes(field)) return null;
      const dir = (dirRaw ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${field} ${dir}`;
    })
    .filter(Boolean);

  return parts.length ? 'ORDER BY ' + parts.join(', ') : 'ORDER BY ' + defaultOrder;
}
