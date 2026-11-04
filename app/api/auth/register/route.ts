import { prisma } from "@/src/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { name, email: rawEmail, password } = await req.json();

  if (!rawEmail || !password || !name) {
    return Response.json({ error: "missing data" }, { status: 400 });
  }

  // 🌟 הופכים הכל לאותיות קטנות כדי למנוע כפילויות!
  const email = rawEmail.toLowerCase(); 

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return Response.json({ error: "user exists" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
    },
  });

  return Response.json({ user });
}