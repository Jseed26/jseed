"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function Globe() {
    const ref = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Cesium.Viewer | null>(null);

    useEffect(() => {
        if (!ref.current || viewerRef.current) return;

        // 🔥 חשוב לשים לפני הכל
        (window as any).CESIUM_BASE_URL = "/cesium";

        // ❗ שימי token אמיתי או תעיפי לגמרי אם לא צריך ion
        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5ZWMyZjIxNC04YTE0LTQwMzEtYTNmMi0zYTMwYzk5MmNhMGMiLCJpZCI6NDMzMDA1LCJpc3MiOiJodHRwczovL2lvbi5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3NzkwOTk1MTR9.ulTUvOMqo8ykSRr-01jBIXqtapOH0doIU2PyeOfNK_k";

        const viewer = new Cesium.Viewer(ref.current, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            infoBox: false,
            selectionIndicator: false,
            scene3DOnly: true,

            // 🔥 חשוב מאוד למנוע קריסות WebGL
            contextOptions: {
                webgl: {
                    alpha: true,
                    preserveDrawingBuffer: false,
                },
            },
        });

        viewerRef.current = viewer;



        viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({
                url: "https://tile.openstreetmap.org/",
            })
        );

        viewerRef.current = viewer;

        requestAnimationFrame(() => {
            if (!viewerRef.current) return;

            viewerRef.current.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(0, 20, 30000000),
                duration: 0,
            });
        });


        return () => {
            viewerRef.current?.destroy();
            viewerRef.current = null;
        };
    }, []);

    return (
        <div
            ref={ref}
            style={{
                width: "100%",
                height: "70vh",
                position: "relative",
                borderRadius: "50%",
                overflow: "hidden",
            }}
        />
    );
}