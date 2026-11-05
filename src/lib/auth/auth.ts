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
            // 🌟 הוספנו את ההרשאה לקשר חשבונות על בסיס אימייל
            allowDangerousEmailAccountLinking: true,
        }),

        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // 🌟 הוספנו את ההרשאה לקשר חשבונות על בסיס אימייל
            allowDangerousEmailAccountLinking: true,
        }),
    ],

    callbacks: {
        async signIn({ user, account, profile }) {
            return true;
        },

        async jwt({ token, user, account, profile, isNewUser, trigger }) {
            if (user) {
                token.id = user.id;
                token.email = user.email ? user.email.toLowerCase() : token.email;

                let finalName = user.name;

                if (account && (account.provider === 'google' || account.provider === 'github')) {
                    try {
                        const cookieStore = await cookies();
                        const desiredName = cookieStore.get("jseed_desired_name")?.value;
                        
                        if (desiredName) {
                            finalName = decodeURIComponent(desiredName);
                        }

                        if (user.id) {
                             await prisma.user.update({
                                 where: { id: user.id },
                                 data: {
                                     email: token.email ?? undefined,
                                     ...(finalName ? { name: finalName } : {})
                                 }
                             });
                        }
                    } catch (error) {
                        console.error("Error updating social user data:", error);
                    }
                }
                
                token.name = finalName; 
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string; 
                session.user.email = token.email as string;
            }
            return session;
        },
    },
});