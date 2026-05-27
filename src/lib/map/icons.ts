import L from "leaflet";

export const createCategoryIcon = (
  category: string
) =>
  L.icon({
    iconUrl: `/icons/categories/${category}/active.png`,

    iconSize: [36, 36],

    iconAnchor: [18, 18],
  });