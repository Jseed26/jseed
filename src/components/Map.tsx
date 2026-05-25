"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/*
================================================================================
🗺️ Leaflet Map Setup – Jseed Project
================================================================================

📌 מה הקובץ הזה עושה?
קומפוננטת מפה אינטראקטיבית מבוססת Leaflet.

המפה:
✔ מציגה עולם בדארק מוד
✔ מציגה נקודות לפי קטגוריות
✔ מאפשרת סינון לפי קטגוריה
✔ תומכת בזום עד רמת רחובות
✔ בנויה לעבודה עתידית עם DB

================================================================================
*/

/*
================================================================================
📦 Props
================================================================================

activeCategory:
הקטגוריה שנבחרה כרגע מה-UI העליון.

אם:
- null → מציגים את כל הנקודות
- "leaf" → מציגים רק עלים
- "circle" → רק עיגולים
וכו'

================================================================================
*/

type MapProps = {
    activeCategory: string | null;
};

export default function Map({
    activeCategory,
}: MapProps) {
    const mapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        /*
        ================================================================================
        🛑 מניעת יצירה כפולה של המפה
        ================================================================================
    
        Next.js במצב dev לפעמים עושה render כפול.
        Leaflet לא מאפשר ליצור מפה פעמיים על אותו DOM element.
        */

        if ((mapRef.current as any)._leaflet_id) {
            (mapRef.current as any)._leaflet_id = null;
        }

        /*
        ================================================================================
        🌍 יצירת מפה
        ================================================================================
        */
  const map = L.map(mapRef.current).setView(
            [31.7683, 35.2137],
            8
        );

        L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            {
                attribution: "&copy; OpenStreetMap & CARTO",
            }
        ).addTo(map);

        /*
        ================================================================================
        🌑 DARK MAP
        ================================================================================
L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            {
                attribution: "&copy; OpenStreetMap & CARTO",
            }
        ).addTo(map);
        
        ================================================================================
        🎨 יצירת אייקון לפי קטגוריה
        ================================================================================
        */

        const createCategoryIcon = (
            category: string
        ) =>
            L.icon({
                iconUrl: `/icons/categories/${category}/active.png`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });

        /*
        ================================================================================
        📍 DATA - נקודות לדוגמה
        ================================================================================
        */

        const points = [
            {
                name: "Cuba Triangle",
                category: "triangle",
                coords: [23.1136, -82.3666],
            },

            {
                name: "Israel Circle",
                category: "circle",
                coords: [31.7683, 35.2137],
            },

            {
                name: "Ushuaia Star",
                category: "star",
                coords: [-54.8019, -68.303],
            },

            {
                name: "Japan Leaf",
                category: "leaf",
                coords: [35.6762, 139.6503],
            },

            {
                name: "Czech Leaf",
                category: "leaf",
                coords: [50.0755, 14.4378],
            },

            {
                name: "Denmark Circle",
                category: "circle",
                coords: [55.6761, 12.5683],
            },

            // ===== CIRCLES =====

            {
                name: "Circle 2",
                category: "circle",
                coords: [40.7128, -74.006],
            },

            {
                name: "Circle 3",
                category: "circle",
                coords: [48.8566, 2.3522],
            },

            {
                name: "Circle 4",
                category: "circle",
                coords: [52.52, 13.405],
            },

            {
                name: "Circle 5",
                category: "circle",
                coords: [-33.8688, 151.2093],
            },

            {
                name: "Circle 6",
                category: "circle",
                coords: [19.4326, -99.1332],
            },

            {
                name: "Circle 7",
                category: "circle",
                coords: [1.3521, 103.8198],
            },

            // ===== STARS =====

            {
                name: "Star 2",
                category: "star",
                coords: [34.0522, -118.2437],
            },

            {
                name: "Star 3",
                category: "star",
                coords: [41.9028, 12.4964],
            },

            {
                name: "Star 4",
                category: "star",
                coords: [59.3293, 18.0686],
            },

            {
                name: "Star 5",
                category: "star",
                coords: [-22.9068, -43.1729],
            },

            {
                name: "Star 6",
                category: "star",
                coords: [37.5665, 126.978],
            },

            // ===== LEAVES =====

            {
                name: "Leaf 3",
                category: "leaf",
                coords: [45.4642, 9.19],
            },

            {
                name: "Leaf 4",
                category: "leaf",
                coords: [60.1699, 24.9384],
            },

            // ===== TRIANGLES =====

            {
                name: "Triangle 2",
                category: "triangle",
                coords: [51.5074, -0.1278],
            },

            {
                name: "Triangle 3",
                category: "triangle",
                coords: [35.6895, 139.6917],
            },

            {
                name: "Triangle 4",
                category: "triangle",
                coords: [39.9042, 116.4074],
            },

            {
                name: "Triangle 5",
                category: "triangle",
                coords: [-1.2921, 36.8219],
            },

            {
                name: "Triangle 6",
                category: "triangle",
                coords: [25.2048, 55.2708],
            },

            {
                name: "Triangle 7",
                category: "triangle",
                coords: [13.7563, 100.5018],
            },

            {
                name: "Triangle 8",
                category: "triangle",
                coords: [64.1466, -21.9426],
            },

            {
                name: "Triangle 9",
                category: "triangle",
                coords: [-34.6037, -58.3816],
            },
        ];

        /*
        ================================================================================
        🔎 FILTER POINTS
        ================================================================================
    
        אם נבחרה קטגוריה:
        מציגים רק אותה.
    
        אחרת:
        מציגים הכל.
        */

        const filteredPoints = activeCategory
            ? points.filter(
                (point) =>
                    point.category === activeCategory
            )
            : points;

        /*
        ================================================================================
        📌 ADD MARKERS
        ================================================================================
        */

        filteredPoints.forEach((point) => {
            L.marker(point.coords as [number, number], {
                icon: createCategoryIcon(point.category),
            })
                .addTo(map)
                .bindPopup(point.name);
        });

        /*
        ================================================================================
        🧹 CLEANUP
        ================================================================================
        */

        return () => {
            map.remove();
        };
    }, [activeCategory]);

    return (
        <div
            ref={mapRef}
            style={{
                width: "100%",
                height: "70vh",
                borderRadius: "24px",
                overflow: "hidden",
                background: "#000",
            }}
        />
    );
}