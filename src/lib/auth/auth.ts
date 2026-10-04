import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/src/lib/prisma";
import bcrypt from "bcryptjs";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";

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

                if (!email || typeof email !== "string") return null;
                if (!password || typeof password !== "string") return null;

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.password) return null;

                const isValid = await bcrypt.compare(password, user.password);

                if (!isValid) return null;

                return {
                    id: user.id.toString(),
                    email: user.email,
                    name: user.name,
                };
            },
        }),

        GitHub({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
        }),

        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),

    ],

    callbacks: {
        async signIn({ user, account }) {
            // בדיקת אבטחה להתחברות דרך גוגל וגיטהאב בלבד
            if (account?.provider === "google" || account?.provider === "github") {
                if (!user.email) return false;

                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });

                // אם המשתמש לא קיים במערכת - כלומר הוא מנסה להירשם עכשיו!
                if (!existingUser) {
                    try {
                        const cookieStore = await cookies();
                        const termsAccepted = cookieStore.get("jseed_terms_accepted")?.value;

                        // אם הוא הגיע ממסך התחברות (בלי עוגייה) נחסום אותו
                        if (termsAccepted !== "true") {
                            // זורקים חזרה לעמוד עם שגיאה
                            return "/auth?error=OAuthNotRegistered";
                        }
                    } catch (e) {
                        // אם יש בעיה בקריאת עוגיות, נחסום ליתר ביטחון
                        return "/auth?error=OAuthNotRegistered";
                    }
                }
            }
            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.name = user.name; // 👈 מוודאים שהשם נכנס לטוקן
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string; // 👈 מעבירים את השם ל-session
            }
            return session;
        },
    },

});