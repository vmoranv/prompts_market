import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "../../../lib/mongodbClientAdapter";
import dbConnect from '../../../lib/dbConnect';
import User from '../../../models/User'; 
import mongoose from 'mongoose';
import { connectToDatabase } from "../../../utils/database";
import QQProvider from "../../../lib/auth/qq-provider";

async function setUserRole(user) {
  try {
    await connectToDatabase();
    
    let existingUser = await User.findOne({ email: user.email });
    
    if (existingUser) {
      return {
        ...user,
        role: existingUser.role || 'user'
      };
    } else {
      const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
      const isAdmin = adminEmails.includes(user.email);
      
      return {
        ...user,
        role: isAdmin ? 'admin' : 'user'
      };
    }
  } catch (error) {
    console.error('检查用户角色时出错:', error);
    return {
      ...user,
      role: 'user'
    };
  }
}

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    //   authorization: {
    //     params: {
    //       prompt: "consent",
    //       access_type: "offline",
    //       response_type: "code",
    //       scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
    //     }
    //   }
    // }),
    // 暂时注释QQ Provider，等待备案号批准
    // QQProvider({
    //   clientId: process.env.QQ_CLIENT_ID,
    //   clientSecret: process.env.QQ_CLIENT_SECRET,
    //   callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback/qq`,
    // }),
  ],
  adapter: MongoDBAdapter(clientPromise),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const userWithRole = await setUserRole(user);
        
        token.userId = userWithRole.id || userWithRole._id;
        token.role = userWithRole.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId;
        session.user.role = token.role;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // if (account.provider === 'google') {
      //   // 处理Google登录后的额外操作
      //   console.log('Google用户数据:', profile);
      // }
      return true;
    },
  },
  pages: {
    signIn: '/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions); 