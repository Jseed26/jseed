import L from "leaflet";

// הוספנו את isViewed
export const createCategoryIcon = (category: string, isViewed: boolean = false) => {
  // אם נצפה - טוען את הכתום, אם לא - טוען את הרגיל
  const fileName = isViewed ? "viewed.png" : "active.png";

  return L.icon({
    iconUrl: `/icons/categories/${category}/${fileName}`,
    iconSize: [30, 30], 
    
    // 👇 עוגן הסמן: איזה חלק בתמונה מצביע בדיוק על הנ"צ? 
    // בדרך כלל זה האמצע של הציר האופקי, והתחתית של הציר האנכי
    iconAnchor: [20, 40], 
    
    // מאיפה הפופאפ יפתח ביחס לעוגן (כדי שלא יכסה את האייקון)
    popupAnchor: [0, -40],
  });
};