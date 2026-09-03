const TYPOS_DICT: Record<string, string> = {
  "כנסט": "כנסת",
  "כנסות": "כנסת",
  "מקוה": "מקווה",
  "חבד": "חב\"ד",
  "shul": "synagogue",
  "jcc": "community center",
  "ביט": "בית"
};

const BILINGUAL_DICT: Record<string, string[]> = {
  synagogue: ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת"],
  prayer: ["תפילה", "מניין", "prayer", "תפילות"],
  community: ["קהילה", "מרכז", "community", "center", "קהילות"],
  heritage: ["מורשת", "היסטוריה", "heritage", "history", "ancient"],
  food: ["אוכל", "מסעדה", "food", "restaurant", "מסעדות", "חב\"ד", "חבד", "כשר", "kosher", "סופר", "סופרמרקט", "supermarket"],
  kosher: ["כשר", "אוכל", "kosher", "חב\"ד", "חבד", "restaurant", "מסעדה", "סופר"],
  restaurant: ["מסעדה", "אוכל", "restaurant", "מסעדות", "כשר"],
  store: ["חנות", "עסק", "store", "shop", "חנויות", "supermarket", "סופר", "סופרמרקט"],
  museum: ["מוזיאון", "מוזיאונים", "מורשת", "היסטוריה", "history", "museum"],
  class: ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  torah: ["תורה", "שיעור", "torah"],
  art: ["אומנות", "גלריה", "art", "gallery", "גלריות"],
  event: ["אירוע", "מפגש", "event", "gathering", "אירועים"],
  spring: ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  nature: ["טבע", "מעיין", "פארק", "nature"],
  chabad: ["חב\"ד", "חבד", "כשר", "אוכל", "תפילה", "שבת", "kosher", "restaurant", "chabad"],
  mikvah: ["מקווה", "טהרה", "mikvah", "mikveh"],
  grave: ["קבר", "צדיק", "רב", "מורשת", "בית עלמין", "tzadik", "cemetery"],
  
  "בית כנסת": ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת", "תפילה", "מניין"],
  "בתי כנסת": ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת", "תפילה", "מניין"],
  "הכנסת": ["בית כנסת", "synagogue", "בית תפילה", "בתי כנסת"], 
  "מוזיאון": ["מוזיאון", "מוזיאונים", "מורשת", "היסטוריה", "history", "museum"],
  "מוזיאונים": ["מוזיאון", "מוזיאונים", "מורשת", "היסטוריה", "history", "museum"], 
  "מעיין": ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  "מעיינות": ["מעיין", "מעיינות", "טבע", "מים", "spring"],
  "תפילה": ["תפילה", "מניין", "prayer", "תפילות", "בית כנסת", "synagogue"],
  "תפילות": ["תפילה", "מניין", "prayer", "תפילות", "בית כנסת", "synagogue"],
  "להתפלל": ["תפילה", "מניין", "prayer", "תפילות", "בית כנסת", "synagogue", "pray"],
  "קהילה": ["קהילה", "מרכז", "community", "center", "קהילות"],
  "קהילות": ["קהילה", "מרכז", "community", "center", "קהילות"],
  "מורשת": ["מורשת", "היסטוריה", "heritage", "history", "מוזיאון"],
  "היסטוריה": ["מורשת", "היסטוריה", "מוזיאון", "עתיק", "history", "museum", "ancient"],
  "אוכל": ["אוכל", "מסעדה", "food", "restaurant", "מסעדות", "חב\"ד", "חבד", "כשר", "kosher", "סופר", "סופרמרקט", "supermarket"],
  "לאכול": ["אוכל", "מסעדה", "food", "restaurant", "מסעדות", "חב\"ד", "חבד", "כשר", "kosher"],
  "כשר": ["כשר", "אוכל", "kosher", "חב\"ד", "חבד", "מסעדה", "restaurant", "סופר"],
  "מסעדה": ["מסעדה", "אוכל", "restaurant", "מסעדות", "כשר", "kosher"],
  "מסעדות": ["מסעדה", "אוכל", "restaurant", "מסעדות", "כשר", "kosher"],
  "סופר": ["סופר", "סופרמרקט", "מכולת", "אוכל", "supermarket", "grocery"],
  "סופרמרקט": ["סופר", "סופרמרקט", "מכולת", "אוכל", "supermarket", "grocery"],
  "חנות": ["חנות", "עסק", "store", "shop", "חנויות", "סופרמרקט"],
  "חנויות": ["חנות", "עסק", "store", "shop", "חנויות"],
  "שיעור": ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  "שיעורים": ["שיעור", "תורה", "class", "lesson", "שיעורים"],
  "תורה": ["תורה", "שיעור", "torah"],
  "אומנות": ["אומנות", "גלריה", "art", "gallery", "גלריות"],
  "אירוע": ["אירוע", "מפגש", "event", "gathering", "אירועים"],
  "אירועים": ["אירוע", "מפגש", "event", "gathering", "אירועים"],
  "חב\"ד": ["חב\"ד", "חבד", "כשר", "אוכל", "תפילה", "שבת", "chabad", "kosher", "restaurant", "בית כנסת"],
  "חבד": ["חב\"ד", "חבד", "כשר", "אוכל", "תפילה", "שבת", "chabad", "kosher", "restaurant", "בית כנסת"],
  "מקווה": ["מקווה", "טהרה", "mikvah", "mikveh"],
  "טהרה": ["מקווה", "טהרה", "mikvah", "mikveh"],
  "שבת": ["שבת", "קידוש", "אירוח", "חב\"ד", "חבד", "קהילה", "shabbat", "shabbos"],
  "קבר": ["קבר", "צדיק", "רב", "מורשת", "בית עלמין", "tzadik", "grave", "cemetery"],
  "צדיק": ["קבר", "צדיק", "רב", "מורשת", "בית עלמין", "tzadik", "grave"]
};

// 🌟 פונקציה חדשה: מנקה כל סוג של מרכאות, פסיקים וצ'ופצ'יקים כדי לעשות השוואה חלקה!
export function cleanTextForMatching(text: string): string {
  if (!text) return "";
  return text.toLowerCase().replace(/["'״׳`]/g, "");
}

// 🌟 פונקציה חדשה: מחזירה מערך של מושגים שלמים (ולא חותכת אותם למילים!)
export function getDictionaryConcepts(query: string): string[] {
  let normalizedQuery = query.toLowerCase();
  for (const [bad, good] of Object.entries(TYPOS_DICT)) {
    normalizedQuery = normalizedQuery.replace(new RegExp(bad, 'g'), good);
  }

  let concepts: string[] = [];

  // 1. קודם בודקים אם יש התאמה לביטוי המלא
  for (const [key, values] of Object.entries(BILINGUAL_DICT)) {
    if (normalizedQuery.includes(key)) {
        concepts.push(...values);
    }
  }

  // 2. מוסיפים גם וריאציות של מילים בודדות
  const words = normalizedQuery.split(/\s+/);
  words.forEach(word => {
    if (BILINGUAL_DICT[word]) concepts.push(...BILINGUAL_DICT[word]);

    const withoutPrefix = word.replace(/^(ב|ל|ו|ה|מ|כ|שה)(?=[א-ת]{2,})/g, "");
    if (withoutPrefix !== word && BILINGUAL_DICT[withoutPrefix]) {
        concepts.push(...BILINGUAL_DICT[withoutPrefix]);
    }
  });

  // מחזירים רשימה נקייה לחלוטין מגרשיים
  return Array.from(new Set(concepts)).map(cleanTextForMatching);
}