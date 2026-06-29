import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-secret",
    }),
    CredentialsProvider({
      name: "Developer / Bypass Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "candidate@grillai.io" },
        name: { label: "Name", type: "text", placeholder: "Candidate One" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        
        // Developer login / fallback when Google is not set up
        const email = credentials.email;
        const name = credentials.name || "Candidate One";
        
        // Upsert developer user
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: {
            email,
            name,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
          },
        });
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      
      try {
        // Upsert user in database
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name || undefined,
            avatar: user.image || undefined,
          },
          create: {
            email: user.email,
            name: user.name || "Candidate",
            avatar: user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name || "User")}`,
          },
        });
        
        // Add ID to token in next callbacks
        user.id = dbUser.id;
        return true;
      } catch (error) {
        console.error("Error signing in user to database:", error);
        return true; // Still allow authentication but log error
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
