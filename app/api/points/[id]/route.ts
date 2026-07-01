import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth/auth";
import { writeFile } from "fs/promises";
import path from "path";
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

async function saveImage(file: File) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${file.name.replace(/\s/g, "")}`;
    const filePath = path.join(process.cwd(), "public/uploads", fileName);

    return `/uploads/${fileName}`;
}

/*
================================================================================
PUT
================================================================================
*/
export async function PUT(req: Request, context: any) {
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

    const keywords = formData.get("keywords") as string | null;

    // const imageFile = formData.get("image") as File | null;

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
    🖼️ IMAGE UPLOAD (אם יש תמונה חדשה)
    ================================================================================
    */
    let imageUrl = existing.imageUrl;

    const imageFile = formData.get("image") as File | null;

    if (imageFile && imageFile.size > 0) {
        imageUrl = await uploadToCloudinary(imageFile);
    }

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
            keywords,

            latitude,
            longitude,
            imageUrl,
        },
    });

    return Response.json(updated);
}

/*
================================================================================
DELETE (נשאר כמעט אותו דבר)
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