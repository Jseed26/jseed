export function normalizeSearchTerm(term: string): string {
  // מסיר תחיליות עבריות נפוצות: ב', ל', ו', ה' אם הן צמודות למילה
  // זה יעזור למצוא "בית כנסת" גם אם חיפשו "לבית כנסת"
  return term.replace(/^(ב|ל|ו|ה|מ)(?=[א-ת]{2})/g, "");
}