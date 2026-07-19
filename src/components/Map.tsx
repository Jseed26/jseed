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

  // נוסיף state למעקב אם אנחנו כרגע במצב "עוקב"
  const [isFollowing, setIsFollowing] = useState(false);

/*
  ================================================================================
  🌍 INIT MAP
  ================================================================================
  */
useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;
    
    // ניקוי למניעת שגיאות רינדור כפול
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = ""; 
    }

    const isMobile = window.innerWidth < 768;
    const minZoom = isMobile ? 1 : 1.5;

    // הגדרת קירות בטון מוחלטים (-90 עד 90 קטבים, -180 עד 180 קווי אורך)
    const worldBounds = L.latLngBounds([-90, -180], [90, 180]);



    const newMap = L.map(container, {
      center: [20, 0], // נשאר אותו דבר
      zoom: minZoom,
      minZoom: minZoom, 
      maxZoom: 18,
      maxBounds: worldBounds, 
      maxBoundsViscosity: 1.0, 
      zoomSnap: 0,
      worldCopyJump: false,
    });

    L.tileLayer(
      'https://tile.jawg.io/b562fdb5-81e4-41c2-b29f-e4134c4f0c08/{z}/{x}/{y}.png?access-token=Yb4rVzthYIC1iujeViPrAOhw1FTOj78Tqqt2jVlTe46c0nixPnht0NEVgOl8ZoI9', 
      {
        attribution: '&copy; <a href="https://www.jawg.io/">Jawg</a>',
        noWrap: true, 
        bounds: worldBounds,
        // 👈 התיקון הקריטי: זה מכריח את המפה להישאר בתוך הגבולות
        // בלי לנסות "לחתוך" את הקצוות החוצה
        keepBuffer: 2 
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

  // מאזין לשגיאות מיקום (אם המשתמש לא אישר GPS)
  useEffect(() => {
    if (!map) return;

    const handleLocationError = (e: any) => {
      alert("לא הצלחנו למצוא את המיקום שלך. ודאי ששירותי המיקום (GPS) דולקים ואישרת לדפדפן לגשת אליהם.");
    };

    map.on("locationerror", handleLocationError);

    return () => {
      map.off("locationerror", handleLocationError);
    };
  }, [map]);


  // כשהמשתמש מזיז את המפה ידנית, נבטל את מצב ה"מעקב" כדי שהכפתור יחזור להציג את ה-GPS
  useEffect(() => {
    if (!map) return;
    const onMove = () => setIsFollowing(false);
    map.on("movestart", onMove);
    return () => { map.off("movestart", onMove); };
  }, [map]);

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

      {/* כפתור מיקום - GPS משולב */}
      <button
        onClick={() => {
          if (!map) return;

          if (isFollowing) {
            // מצב א': אם כבר עוקב - בצע זום אאוט לכל העולם
            map.setView([31.7683, 35.2137], 3); // מרכז המפה וזום רחוק
            setIsFollowing(false);
          } else {
            // מצב ב': אם לא עוקב - טוס למיקום הנוכחי
            map.locate({
              setView: true,
              maxZoom: 16,
              enableHighAccuracy: true
            });
            setIsFollowing(true);
          }
        }}
        className="absolute bottom-6 right-6 z-[400] bg-gray-900 border border-gray-700 p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        title={isFollowing ? "זום אאוט למפה" : "המיקום שלי"}
      >
        {isFollowing ? (
          // אייקון זום אאוט (העולם)
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          // אייקון כוונת (GPS)
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414m13.314 0l-1.414-1.414M6.05 6.05L4.636 4.636M12 15a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        )}
      </button>
    </div>
  );
}