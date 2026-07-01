import { prisma } from "@/src/lib/prisma";
import cloudinary from "@/src/lib/cloudinary";
import { TAG_DICTIONARY } from "@/src/lib/tagsDictionary";
import { auth } from "@/src/lib/auth/auth";


/**
 * GET - כל הנקודות (עם חיפוש + קטגוריה)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const qRaw = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category") || undefined;

  const andConditions: any[] = [];

  if (category) {
    andConditions.push({ category });
  }

  if (qRaw) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: qRaw,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: qRaw,
            mode: "insensitive",
          },
        },
        {
          address: {
            contains: qRaw,
            mode: "insensitive",
          },
        },
        {
          website: {
            contains: qRaw,
            mode: "insensitive",
          },
        },
        {
          keywords: {
            contains: qRaw,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  const results = await prisma.point.findMany({
    where: {
      AND: andConditions,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json(results);
}



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

    const keywords = formData.get("keywords") as string | null;

    // ✅ מגיע מהקליינט
    const tagsRaw = formData.get("tags") as string | null;

    const tags: string[] =
      tagsRaw && tagsRaw !== "[]"
        ? JSON.parse(tagsRaw)
        : extractTags(description || "");

    let imageUrl: string | null = null;

    const session = await auth();

    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId: session.user.id

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "points" }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          })
          .end(buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    let finalLatitude = latitude;
    let finalLongitude = longitude;

    if (address?.trim()) {
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

      if (results?.length) {
        finalLatitude = Number(results[0].lat);
        finalLongitude = Number(results[0].lon);
      }
    }

    const newPoint = await prisma.point.create({
      data: {
        name,
        category,
        latitude: finalLatitude,
        longitude: finalLongitude,
        description: description || null,
        imageUrl,
        address: address || null,
        website: website || null,
        keywords: keywords || null,
        userId: session.user.id,
      },
    });

    return Response.json(newPoint);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create point" },
      { status: 500 }
    );
  }
}

/**
 * fallback tags
 */
function extractTags(text: string) {
  const keywords = [
    "בית כנסת",
    "תפילה",
    "קהילה",
    "מורשת",
    "עסק",
    "חנות",
    "אירוע",
    "זיכרון",
    "אומנות",
    "גלריה",
    "שיעור",
    "תורה",
    "אוכל",
  ];

  return keywords.filter((k) => text.includes(k));
}