"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useMapMarkers } from "@/src/hooks/useMapMarkers";
import { Point } from "@/src/types/point";
import { useSession } from "next-auth/react";
import PointForm from "@/src/components/PointForm";

type MapProps = {
  activeCategory: Point["category"] | null;
  isCompassMode: boolean;
  setCompassMode: (value: boolean) => void;
  searchQuery: string;
  isLoggedIn: boolean;
};

type ModalState = {
  lat: number;
  lng: number;
} | null;

export default function Map({
  activeCategory,
  isCompassMode,
  searchQuery,
  setCompassMode,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [modal, setModal] = useState<ModalState>(null);

  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]); // 👈 1. סטייט חדש לשמירת מזהי הנקודות השמורות

  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  /*
  ================================================================================
  🌍 INIT MAP
  ================================================================================
  */
  useEffect(() => {
    if (!mapRef.current) return;

    if ((mapRef.current as any)._leaflet_id) {
      (mapRef.current as any)._leaflet_id = null;
    }

    // הגדרת גבולות קשיחים - מונע גרירה של המפה לאזורים ריקים בצפון/דרום ובקטבים
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    const newMap = L.map(mapRef.current, {
      center: [31.7683, 35.2137], // מרכז ראשוני
      zoom: 3, // זום התחלתי שמציג את רוב העולם
      minZoom: 1.5, 
      maxZoom: 18,
      maxBounds: bounds, // 👈 נועל את גרירת המפה בתוך גבולות העולם
      maxBoundsViscosity: 1.0, // 👈 הופך את הגבול ל"קיר קשיח" - המפה לא תקפוץ החוצה
      worldCopyJump: false,
    });

    // שימוש באריחים כהים (Dark Matter) שמתאימים לעיצוב השחור-זהב שלך
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap & CARTO",
        noWrap: true,
        bounds: bounds,
      }
    ).addTo(newMap);

    setMap(newMap);

    return () => {
      newMap.remove();
    };
  }, []);
  /*
  ================================================================================
  📡 LOAD POINTS, HISTORY & SAVED
  ================================================================================
  */
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/points");
      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    }

    load();
  }, []);

  // משיכת ההיסטוריה של המשתמש בטעינת המפה
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadHistory() {
      try {
        const res = await fetch("/api/history");
        if (res.ok) {
          const data = await res.json();
          setViewedIds(data.map((p: Point) => p.id));
        }
      } catch (err) {
        console.error("Failed to load history", err);
      }
    }

    loadHistory();
  }, [isLoggedIn]);

  // 👈 2. משיכת רשימת הנקודות השמורות של המשתמש בטעינת המפה
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadSaved() {
      try {
        const res = await fetch("/api/saved");
        if (res.ok) {
          const data = await res.json();
          setSavedIds(data.map((p: Point) => p.id));
        }
      } catch (err) {
        console.error("Failed to load saved points", err);
      }
    }

    loadSaved();
  }, [isLoggedIn]);

  /*
  ================================================================================
  🔄 SEARCH
  ================================================================================
  */
  useEffect(() => {
    async function search() {
      const params = new URLSearchParams();

      if (searchQuery.trim()) params.append("q", searchQuery);
      if (activeCategory) params.append("category", activeCategory);

      const res = await fetch(`/api/points?${params.toString()}`);
      const data = await res.json();

      setPoints(data);
    }

    search();
  }, [searchQuery, activeCategory]);

  /*
  ================================================================================
  🔄 LIVE REFRESH (מתעדכן כשנוצרת נקודה או כשמשתנה סטטוס שמירה)
  ================================================================================
  */
  useEffect(() => {
    const refresh = async () => {
      // רענון נקודות כלליות במפה
      const res = await fetch("/api/points");
      const data = await res.json();
      setPoints(data);

      // 👈 3. רענון רשימת השמורים בזמן אמת
      if (isLoggedIn) {
        const resSaved = await fetch("/api/saved");
        if (resSaved.ok) {
          const savedData = await resSaved.json();
          setSavedIds(savedData.map((p: Point) => p.id));
        }
      }
    };

    window.addEventListener("points-updated", refresh);

    return () => {
      window.removeEventListener("points-updated", refresh);
    };
  }, [isLoggedIn]);

  /*
  ================================================================================
  📍 MAP CLICK (SELECT CENTER LOCATION)
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isCompassMode) return;

      if (!activeCategory) {
        alert("צריך לבחור קטגוריה לפני הוספת נקודה");
        return;
      }

      if (!isLoggedIn) {
        alert("צריך להתחבר כדי להוסיף נקודה");
        return;
      }

      setModal({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, isCompassMode, activeCategory, isLoggedIn]);

  /*
  ================================================================================
  📍 MARKERS
  ================================================================================
  */
  useMapMarkers({
    map,
    points,
    activeCategory,
    viewedIds,
    savedIds, // 👈 4. העברת רשימת השמורים ל-Hook של המרקרים
  });

  /*
  ================================================================================
  🧠 UI
  ================================================================================
  */
  return (
    <div className="relative w-full h-[70vh]">

      {/* MAP */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl overflow-hidden bg-black relative"
      />

      {/* CROSSHAIR (PLUS) OVERLAY */}
      {isCompassMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 text-[#FFD700] drop-shadow-[0_0_2px_rgba(255,255,255,1)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <PointForm
          mode="create"
          category={activeCategory}
          initialData={{
            lat: modal.lat,
            lng: modal.lng,
          }}
          onClose={() => setModal(null)}
          onSubmit={async ({ form }) => {
            if (status !== "authenticated") return;

            const formData = new FormData();

            formData.append("name", form.name);
            formData.append("description", form.description);
            formData.append("address", form.address);
            formData.append("website", form.website);
            formData.append("category", activeCategory ?? "");
            formData.append("latitude", String(modal.lat));
            formData.append("longitude", String(modal.lng));

            if (form.image) {
              formData.append("image", form.image);
            }

            if (form.extraInfo) {
              formData.append("extraInfo", form.extraInfo);
            }

            console.log("Modal coordinates:", modal.lat, modal.lng);

            const res = await fetch("/api/points", {
              method: "POST",
              body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
              alert(data.error);
              return;
            }

            setPoints((prev) => [...prev, data]);
            setModal(null);
            setCompassMode(false);
          }}
        />
      )}
    </div>
  );
}