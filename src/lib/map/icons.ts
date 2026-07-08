import L from "leaflet";

// הוספנו את isViewed
export const createCategoryIcon = (category: string, isViewed: boolean = false) => {
  // אם נצפה - טוען את הכתום, אם לא - טוען את הרגיל
  const fileName = isViewed ? "viewed.png" : "active.png";

  return L.icon({
    iconUrl: `/icons/categories/${category}/${fileName}`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};