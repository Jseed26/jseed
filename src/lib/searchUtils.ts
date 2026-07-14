// src/lib/searchUtils.ts

const BILINGUAL_DICT: Record<string, string[]> = {
  // --- אנגלית -> עברית ואנגלית ---
  synagogue: ["בית כנסת", "synagogue", "בית תפילה"],
  prayer: ["תפילה", "מניין", "prayer"],
  community: ["קהילה", "מרכז", "community", "center"],
  heritage: ["מורשת", "היסטוריה", "heritage", "history"],
  food: ["אוכל", "מסעדה", "food", "restaurant"],
  kosher: ["כשר", "אוכל", "kosher"],
  restaurant: ["מסעדה", "אוכל", "restaurant"],
  store: ["חנות", "עסק", "store", "shop"],
  class: ["שיעור", "תורה", "class", "lesson"],
  torah: ["תורה", "שיעור", "torah"],
  art: ["אומנות", "גלריה", "art", "gallery"],
  event: ["אירוע", "מפגש", "event", "gathering"],

  // --- עברית -> עברית ואנגלית (התיקון החדש!) ---
  "בית כנסת": ["בית כנסת", "synagogue", "בית תפילה"],
  "תפילה": ["תפילה", "מניין", "prayer"],
  "קהילה": ["קהילה", "מרכז", "community", "center"],
  "מורשת": ["מורשת", "היסטוריה", "heritage", "history"],
  "אוכל": ["אוכל", "מסעדה", "food", "restaurant"],
  "כשר": ["כשר", "אוכל", "kosher"],
  "מסעדה": ["מסעדה", "אוכל", "restaurant"],
  "חנות": ["חנות", "עסק", "store", "shop"],
  "שיעור": ["שיעור", "תורה", "class", "lesson"],
  "תורה": ["תורה", "שיעור", "torah"],
  "אומנות": ["אומנות", "גלריה", "art", "gallery"],
  "אירוע": ["אירוע", "מפגש", "event", "gathering"]
};

export function normalizeSearchTerm(term: string): string[] {
  if (!term || term.trim() === "") return [];

  const lowerTerm = term.trim().toLowerCase();

  // עכשיו זה יתפוס גם מילים באנגלית וגם מילים בעברית מתוך המילון!
  if (BILINGUAL_DICT[lowerTerm]) {
    return BILINGUAL_DICT[lowerTerm];
  }

  // ניקוי תחיליות עבריות אם המילה לא במילון
  const cleanHebrew = lowerTerm.replace(/^(ב|ל|ו|ה)(?=[א-ת]{2,})/g, "");
  
  return [cleanHebrew];
}