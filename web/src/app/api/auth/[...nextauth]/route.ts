import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { API_BASE_URL } from "@/lib/utils"

const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: "openid email profile",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt" as const,
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: '/',
        error: '/auth/error',
    },
    callbacks: {
        async signIn({ user, account, profile }: any) {
            if (account?.provider === "google") {
                try {
                    const userData = {
                        uid: user.id,
                        name: user.name,
                        email: user.email,
                        photo_url: user.image,
                        locale: profile?.locale,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    };

                    console.log(`[NextAuth] Syncing user to: ${API_BASE_URL}/api/users/sync`);
                    const res = await fetch(`${API_BASE_URL}/api/users/sync`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(userData),
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error(`[NextAuth] Sync failed. Status: ${res.status}. Response: ${errorText}`);
                        // Allow sign in even if sync fails, but log the error
                        return true;
                    }

                    const data = await res.json();
                    console.log(`[NextAuth] User sync successful:`, data);
                    return true;
                } catch (error) {
                    console.error("[NextAuth] Error syncing user:", error);
                    // Allow sign in even if sync fails
                    return true;
                }
            }
            return true;
        },
        async jwt({ token, account, user }: any) {
            if (account) {
                token.accessToken = account.access_token;
            }
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }: any) {
            if (session.user) {
                session.user.id = token.sub || token.id;
            }
            session.accessToken = token.accessToken;
            return session;
        },
        async redirect({ url, baseUrl }: any) {
            // Allows relative callback URLs
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // Allows callback URLs on the same origin
            else if (new URL(url).origin === baseUrl) return url;
            return baseUrl + '/dashboard';
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

