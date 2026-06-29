import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/src/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),

    session: {
        strategy: "jwt",
    },

    providers: [
        Credentials({
            credentials: {
                email: {},
                password: {},
            },

            async authorize(credentials) {
                const email = credentials?.email;
                const password = credentials?.password;

                // בדיקות תקינות
                if (!email || typeof email !== "string") return null;
                if (!password || typeof password !== "string") return null;

                // שליפת משתמש מה-DB
                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.password) return null;

                // בדיקת סיסמה
                const isValid = await bcrypt.compare(password, user.password);

                if (!isValid) return null;

                // החזרת user ל-next-auth
                return {
                    id: user.id.toString(),
                    email: user.email,
                    name: user.name,
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});