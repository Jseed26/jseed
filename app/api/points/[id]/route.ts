import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { uploadToCloudinary } from "@/src/lib/uploadToCloudinary";

async function geocodeAddress(address: string) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                address
            )}`,
            {
                headers: {
                    "User-Agent": "jseed-app",
                },
            }
        );

        const data = await res.json();

        if (data?.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
            };
        }

        return null;
    } catch (e) {
        console.error("Geocode error:", e);
        return null;
    }
}

/*
================================================================================
PUT - עריכת נקודה עם תמיכה בעד 3 תמונות
================================================================================
*/
export async function PUT(req: Request, context: any) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        const pointId = Number(id);

        const formData = await req.formData();

        const name = (formData.get("name") as string) || "";
        const description = (formData.get("description") as string) || "";
        const category = (formData.get("category") as string) || "";
        const address = (formData.get("address") as string) || "";
        const website = (formData.get("website") as string) || "";
        const extraInfo = formData.get("extraInfo") as string | null;

        const existing = await prisma.point.findFirst({
            where: {
                id: pointId,
                userId: session.user.id,
            },
        });

        if (!existing) {
            return Response.json({ error: "Not found" }, { status: 404 });
        }

        /*
        ================================================================================
        📍 GEO UPDATE (אם כתובת השתנתה)
        ================================================================================
        */
        let latitude = existing.latitude;
        let longitude = existing.longitude;

        if (address && address !== existing.address) {
            const geo = await geocodeAddress(address);

            if (geo) {
                latitude = geo.lat;
                longitude = geo.lng;
            }
        }

        /*
        ================================================================================
        🖼️ IMAGE UPLOAD (שילוב תמונות ישנות וחדשות)
        ================================================================================
        */
        
        // 1. שולפים את הלינקים של התמונות שהמשתמש השאיר (לא מחק ב-X)
        const existingImages = formData.getAll("existingImages") as string[];
        
        // 2. שולפים את הקבצים החדשים שהמשתמש הוסיף
        const newImageFiles = formData.getAll("images") as File[];
        let newlyUploadedUrls: string[] = [];

        // 3. מעלים את כל התמונות החדשות לענן (אם יש כאלה)
        if (newImageFiles && newImageFiles.length > 0) {
            // רצים על כל הקבצים ומעלים אותם במקביל באמצעות הפונקציה שלך
            const uploadPromises = newImageFiles.map(async (file) => {
                if (file.size > 0) {
                    return await uploadToCloudinary(file);
                }
                return null;
            });
            
            const results = await Promise.all(uploadPromises);
            newlyUploadedUrls = results.filter((url): url is string => url !== null);
        }

        // 4. מחברים את הלינקים הישנים עם הלינקים החדשים למערך אחד סופי (מוודאים מקסימום 3)
        const finalImageUrls = [...existingImages, ...newlyUploadedUrls].slice(0, 3);

        /*
        ================================================================================
        💾 UPDATE DB
        ================================================================================
        */
        const updated = await prisma.point.update({
            where: { id: pointId },
            data: {
                name,
                description,
                category,
                address,
                website,
                extraInfo,
                latitude,
                longitude,
                
                // שומרים את מערך התמונות המעודכן
                imageUrls: finalImageUrls,
                // תאימות לאחור: השדה הישן יקבל את התמונה הראשונה, או null אם אין תמונות בכלל
                imageUrl: finalImageUrls.length > 0 ? finalImageUrls[0] : null,
            },
        });

        return Response.json(updated);
    } catch (error) {
        console.error("PUT Error:", error);
        return Response.json({ error: "Failed to update point" }, { status: 500 });
    }
}

/*
================================================================================
DELETE (נשאר ללא שינוי)
================================================================================
*/
export async function DELETE(req: Request, context: any) {
    const session = await auth();

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const pointId = Number(id);

    const existing = await prisma.point.findFirst({
        where: {
            id: pointId,
            userId: session.user.id,
        },
    });

    if (!existing) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.point.delete({
        where: { id: pointId },
    });

    return Response.json({ success: true });
}