"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useMapMarkers } from "@/src/hooks/useMapMarkers";
import { Point } from "@/src/types/point";

type MapProps = {
  activeCategory: Point["category"] | null;
  isCompassMode: boolean;
};

export default function Map({
  activeCategory,
  isCompassMode,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const [createModal, setCreateModal] = useState<null | {
    lat: number;
    lng: number;
  }>(null);

  const isMobile =
    typeof window !== "undefined" &&
    window.innerWidth < 768;

  /*
  ================================================================================
  🌍 Create map once
  ================================================================================
  */
  useEffect(() => {
    if (!mapRef.current) return;

    // prevent duplicate init
    if ((mapRef.current as any)._leaflet_id) {
      (mapRef.current as any)._leaflet_id = null;
    }

    const newMap = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 18,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; OpenStreetMap & CARTO",
      }
    ).addTo(newMap);

    setMap(newMap);

    return () => {
      newMap.remove();
    };
  }, []);

  /*
  ================================================================================
  📡 Load points
  ================================================================================
  */
  useEffect(() => {
    async function loadPoints() {
      try {
        const res = await fetch("/api/points");
        const data = await res.json();

        setPoints(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load points:", err);
      }
    }

    loadPoints();
  }, []);

  /*
  ================================================================================
  📍 Click on map → open modal
  ================================================================================
  */
  useEffect(() => {
    if (!map) return;

    // const container = map.getContainer();
    // container.style.cursor = isCompassMode ? "crosshair" : "";

    const container = map.getContainer();

    container.style.cursor = isCompassMode ? "none" : "";

    const handleClick = (e: any) => {
      if (!isCompassMode) return;

      if (!activeCategory) {
        alert("בחרי קטגוריה קודם");
        return;
      }

      const { lat, lng } = e.latlng;

      setCreateModal({ lat, lng });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [map, isCompassMode, activeCategory]);


  useEffect(() => {
    if (!isCompassMode) return;

    const handleMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMove);

    return () => {
      window.removeEventListener("mousemove", handleMove);
    };
  }, [isCompassMode]);
  /*
  ================================================================================
  📍 Markers
  ================================================================================
  */
  useMapMarkers({
    map,
    points,
    activeCategory,
  });

  /*
  ================================================================================
  🧠 UI
  ================================================================================
  */
  return (
    <div className="relative w-full h-full">

      {isCompassMode && !isMobile && (
        <img
          src="/icons/ui/compass/default.png"
          style={{
            position: "fixed",
            left: cursorPos.x + 12,
            top: cursorPos.y + 12,
            width: 32,
            height: 32,
            pointerEvents: "none",
            zIndex: 99999,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {isCompassMode && (
        <div
          className="
      absolute
      top-6
      left-1/2
      -translate-x-1/2
      z-[9998]
      bg-black/70
      backdrop-blur-md
      text-white
      px-5
      py-3
      rounded-2xl
      text-center
      shadow-lg
      pointer-events-none
    "
        >
          <div className="font-semibold">
            🧭 מצב יצירת נקודה
          </div>

          <div className="text-sm opacity-80">
            לחצי על מקום במפה
            <br />
            כדי ליצור נקודה חדשה
          </div>
        </div>
      )}

      {isCompassMode && (
        <div
          className="
      absolute
      left-1/2
      top-1/2
      -translate-x-1/2
      -translate-y-1/2
      z-[9997]
      pointer-events-none
    "
        >
          <div className="relative w-10 h-10">
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-yellow-400 -translate-x-1/2 opacity-70" />
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-yellow-400 -translate-y-1/2 opacity-70" />
          </div>
        </div>
      )}


      {/* MAP */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "70vh",
          borderRadius: "24px",
          overflow: "hidden",
          background: "#000",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* MODAL */}
      {createModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-[9999]"
          onClick={() => setCreateModal(null)}
        >
          <div
            className="bg-white text-black p-6 rounded-xl w-[380px] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">יצירת נקודה</h2>

                <p className="text-sm text-gray-500">
                  Lat: {createModal.lat.toFixed(5)}
                  <br />
                  Lng: {createModal.lng.toFixed(5)}
                </p>
              </div>

              {activeCategory && (
                <div className="flex flex-col items-center">
                  <img
                    src={`/icons/categories/${activeCategory}/active.png`}
                    alt={activeCategory}
                    className="w-14 h-14 object-contain"
                  />

                  <span className="text-xs mt-1 text-gray-600">
                    {activeCategory === "leaf" && "קהילה"}
                    {activeCategory === "star" && "רוח"}
                    {activeCategory === "triangle" && "מורשת"}
                    {activeCategory === "circle" && "עסקים"}
                  </span>
                </div>
              )}
            </div>

            <input
              id="pointName"
              placeholder="שם הנקודה"
              className="w-full border p-2 rounded"
            />

            <textarea
              id="pointDesc"
              placeholder="תיאור קצר"
              className="w-full border p-2 rounded"
            />

            <input
              type="file"
              id="pointImage"
              accept="image/*"
            />

            <input
              id="pointAddress"
              placeholder="כתובת"
              className="w-full border p-2 rounded"
            />

            <input
              id="pointWebsite"
              placeholder="קישור"
              className="w-full border p-2 rounded"
            />

            <div className="flex justify-between">
              <button
                onClick={() => setCreateModal(null)}
                className="text-red-500"
              >
                ביטול
              </button>

              <button
                onClick={async () => {
                  const name = (
                    document.getElementById("pointName") as HTMLInputElement
                  ).value;

                  const description = (
                    document.getElementById("pointDesc") as HTMLTextAreaElement
                  ).value;

                  const fileInput =
                    document.getElementById("pointImage") as HTMLInputElement;

                  const file = fileInput.files?.[0];

                  const address = (
                    document.getElementById("pointAddress") as HTMLInputElement
                  ).value;

                  const website = (
                    document.getElementById("pointWebsite") as HTMLInputElement
                  ).value;

                  const formData = new FormData();

                  formData.append("name", name);
                  formData.append("description", description);
                  formData.append("address", address);
                  formData.append("website", website);
                  formData.append("category", activeCategory ?? "");
                  formData.append("latitude", String(createModal.lat));
                  formData.append("longitude", String(createModal.lng));

                  if (file) {
                    formData.append("image", file);
                  }

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

                  setCreateModal(null);

                }}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black hover:scale-105 transition"
              >
                <img
                  src="/icons/ui/compass/default.png"
                  className="w-6 h-6"
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}