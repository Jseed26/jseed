import L from "leaflet";

// הוספנו את המשתנה currentZoom (ברירת מחדל 12 כדי שלא ישבר אם לא נעביר)
export const createCategoryIcon = (category: string, isViewed: boolean = false, currentZoom: number = 12) => {
  const fileName = isViewed ? "viewed.png" : "active.png";

  // 🧮 חישוב הגודל הדינמי:
  // אם הזום רחוק (עד 12), הגודל יישאר קטן כמו שאת אוהבת (10 פיקסלים).
  // כל רמת זום מעל 12, תוסיף 4 פיקסלים לגודל. 
  // (זום 13 = 14px, זום 16 = 26px וכו'). את יכולה לשחק עם המספר 4 כדי להאיץ את הגדילה.
  const minSize = 10;
  const size = currentZoom <= 8 ? minSize : minSize + (currentZoom - 8) * 6;

  return L.icon({
    iconUrl: `/icons/categories/${category}/${fileName}`,
    
    // הגודל מחושב אוטומטית לפי הנוסחה למעלה
    iconSize: [size, size], 
    
    // 👇 התיקון הקריטי: העוגן תמיד יהיה [אמצע הרוחב, תחתית הגובה] לפי הגודל החדש!
    iconAnchor: [size / 2, size], 
    
    // הבועה נפתחת בדיוק מעל האייקון
    popupAnchor: [0, -size],
  });
};