import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!.+\\/[\\w]+$|_next.*)", // Matches all routes except those with file extensions or _next
    "/", // Root route
    "/(api/trpc)(.*)" // API routes for trpc
  ],
};
