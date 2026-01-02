import { withAuth } from "next-auth/middleware"

export default withAuth({
    pages: {
        signIn: "/", // Redirect to home/login if not authenticated
    },
})

export const config = { matcher: ["/dashboard/:path*"] }
