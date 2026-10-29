// 저장소 구현(sqlite, supabase)이 함께 쓰는 값

// 카테고리 없음을 가리키는 특별한 값 (?category=__none__)
export const NO_CATEGORY = '__none__';

// 'YYYY-MM-DD' 형식인지 (쿼리에 날짜를 넣기 전에 한 번 더 확인한다)
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
