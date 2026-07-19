import L from "leaflet";

// הוספנו את isViewed
export const createCategoryIcon = (category: string, isViewed: boolean = false) => {
  // אם נצפה - טוען את הכתום, אם לא - טוען את הרגיל
  const fileName = isViewed ? "viewed.png" : "active.png";

  return L.icon({
    iconUrl: `/icons/categories/${category}/${fileName}`,
    
    // הגודל המקורי של האייקון שלך
    iconSize: [30, 30], 
    
    // 👇 התיקון: [אמצע הרוחב, מלוא הגובה]
    // 15 = בדיוק האמצע של 30. 
    // 30 = התחתית של התמונה, איפה שהשפיץ נמצא.
    iconAnchor: [15, 30], 
    
    // הבועה נפתחת בדיוק מעל האייקון (מינוס הגובה שלו)
    popupAnchor: [0, -30],
  });
};