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
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Best guess from server/client
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
                    }
                    return true;
                } catch (error) {
                    console.error("Error syncing user:", error);
                    return true; // Allow sign in even if sync fails? Or false? Let's allow for now but log.
                }
            }
            return true;
        },
        async jwt({ token, account }: any) {
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }: any) {
            session.user.id = token.sub;
            session.accessToken = token.accessToken;
            return session;
        },
        async redirect({ url, baseUrl }: any) {
            return baseUrl + '/dashboard';
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
