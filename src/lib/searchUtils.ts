// src/lib/searchUtils.ts

const BILINGUAL_DICT: Record<string, string[]> = {
  // --- אנגלית -> עברית ואנגלית ---
  synagogue: ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת"],
  prayer: ["תפילה", "מניין", "prayer", "תפילות"],
  community: ["קהילה", "מרכז", "community", "center", "קהילות"],
  heritage: ["מורשת", "היסטוריה", "heritage", "history"],
  food: ["אוכל", "מסעדה", "food", "restaurant", "מסעדות"],
  kosher: ["כשר", "אוכל", "kosher"],
  restaurant: ["מסעדה", "אוכל", "restaurant", "מסעדות"],
  store: ["חנות", "עסק", "store", "shop", "חנויות"],
  class: ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  torah: ["תורה", "שיעור", "torah"],
  art: ["אומנות", "גלריה", "art", "gallery", "גלריות"],
  event: ["אירוע", "מפגש", "event", "gathering", "אירועים"],
  spring: ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  nature: ["טבע", "מעיין", "פארק", "nature"],

  // --- עברית (יחיד + רבים) -> עברית ואנגלית ---
  "בית כנסת": ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת"],
  "בתי כנסת": ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת"],
  
  "מעיין": ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  "מעיינות": ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  
  "תפילה": ["תפילה", "מניין", "prayer", "תפילות"],
  "תפילות": ["תפילה", "מניין", "prayer", "תפילות"],
  
  "קהילה": ["קהילה", "מרכז", "community", "center", "קהילות"],
  "קהילות": ["קהילה", "מרכז", "community", "center", "קהילות"],
  
  "מורשת": ["מורשת", "היסטוריה", "heritage", "history"],
  
  "אוכל": ["אוכל", "מסעדה", "food", "restaurant", "מסעדות"],
  "כשר": ["כשר", "אוכל", "kosher"],
  
  "מסעדה": ["מסעדה", "אוכל", "restaurant", "מסעדות"],
  "מסעדות": ["מסעדה", "אוכל", "restaurant", "מסעדות"],
  
  "חנות": ["חנות", "עסק", "store", "shop", "חנויות"],
  "חנויות": ["חנות", "עסק", "store", "shop", "חנויות"],
  
  "שיעור": ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  "שיעורים": ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  
  "תורה": ["תורה", "שיעור", "torah"],
  
  "אומנות": ["אומנות", "גלריה", "art", "gallery", "גלריות"],
  
  "אירוע": ["אירוע", "מפגש", "event", "gathering", "אירועים"],
  "אירועים": ["אירוע", "מפגש", "event", "gathering", "אירועים"]
};

export function normalizeSearchTerm(term: string): string[] {
  if (!term || term.trim() === "") return [];

  const lowerTerm = term.trim().toLowerCase();
  
  // נאסוף לפה את כל הוריאציות של מילת החיפוש
  let results: string[] = [lowerTerm];

  // 1. אם המילה המדויקת קיימת במילון, נחזיר מיד את כל המילים הקשורות אליה
  if (BILINGUAL_DICT[lowerTerm]) {
    return Array.from(new Set([...results, ...BILINGUAL_DICT[lowerTerm]]));
  }

  // 2. ניקוי תחיליות נפוצות בעברית (ב, ל, ו, ה, מ, כ, שה)
  // למשל: "המעיינות" יהפוך ל-"מעיינות"
  const withoutPrefix = lowerTerm.replace(/^(ב|ל|ו|ה|מ|כ|שה)(?=[א-ת]{2,})/g, "");
  
  if (withoutPrefix !== lowerTerm) {
    results.push(withoutPrefix);
    // אם אחרי הניקוי מצאנו את המילה במילון, נוסיף את הכל
    if (BILINGUAL_DICT[withoutPrefix]) {
      results.push(...BILINGUAL_DICT[withoutPrefix]);
    }
  }

  // 3. מנוע גילוח חכם (Stemming) למילים שאינן במילון!
  // מוריד סיומות של רבים כדי לחפש גם את צורת היחיד בבסיס הנתונים
  
  const currentBase = withoutPrefix || lowerTerm; // עובדים על המילה הנקייה מקידומות

  // חיתוך "ים" (למשל: "פסלים" -> "פסל")
  const singularSuffix1 = currentBase.replace(/ים$/, ""); 
  
  // חיתוך "ות" -> החלפה ל"ה" (למשל: "תצוגות" -> "תצוגה")
  const singularSuffix2 = currentBase.replace(/ות$/, "ה"); 
  
  // חיתוך "ות" -> החלפה ל"ת" (למשל: "תצפיות" -> "תצפית")
  const singularSuffix3 = currentBase.replace(/ות$/, "ת"); 

  if (singularSuffix1 !== currentBase && singularSuffix1.length > 1) results.push(singularSuffix1);
  if (singularSuffix2 !== currentBase && singularSuffix2.length > 1) results.push(singularSuffix2);
  if (singularSuffix3 !== currentBase && singularSuffix3.length > 1) results.push(singularSuffix3);

  // החזרת מערך ייחודי בלבד (מנקה כפילויות אם נוצרו)
  return Array.from(new Set(results));
}