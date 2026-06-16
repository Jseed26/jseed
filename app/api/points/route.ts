import { prisma } from "@/src/lib/prisma";
import cloudinary from "@/src/lib/cloudinary";


/**
 * GET - כל הנקודות
 */
export async function GET() {
  try {
    const points = await prisma.point.findMany({
      orderBy: { createdAt: "desc" },
    });

    return Response.json(points);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}

/**
 * POST - יצירת נקודה + העלאת תמונה ל-Cloudinary
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const address = formData.get("address") as string;
    const website = formData.get("website") as string;

    const file = formData.get("image") as File | null;

    let imageUrl: string | null = null;

    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: "points",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    if (address?.trim()) {
      try {
        console.log("ADDRESS:", address);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address
          )}&limit=1`,
          {
            headers: {
              "User-Agent": "JSeed/1.0",
            },
          }
        );

        const results = await response.json();

        console.log("GEOCODE RESULTS:", results);

        if (results.length === 0) {
          return Response.json(
            { error: "הכתובת לא נמצאה" },
            { status: 400 }
          );
        }

        finalLatitude = Number(results[0].lat);
        finalLongitude = Number(results[0].lon);

        console.log(
          "FOUND:",
          finalLatitude,
          finalLongitude,
          results[0].display_name
        );

        console.log(
          "SAVING:",
          finalLatitude,
          finalLongitude
        );
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }

    const newPoint = await prisma.point.create({
      data: {
        name,
        category,
        latitude: finalLatitude,
        longitude: finalLongitude,
        description: description || null,
        imageUrl: imageUrl ?? null,
        address: address || null,
        website: website || null,
      },
    });

    return Response.json(newPoint);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create point" }, { status: 500 });
  }
}