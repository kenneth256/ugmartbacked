import type { Request, Response, NextFunction } from "express";
import { jwtVerify, type JWTPayload } from 'jose';
import prisma from "../lib/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  },
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;
    
    console.log('Auth check - has accessToken:', !!accessToken, 'has refreshToken:', !!refreshToken);
    
    if (accessToken) {
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }

        const { payload } = await jwtVerify(accessToken, new TextEncoder().encode(secret));
        
        const userPayload = payload as JWTPayload & {
          id: string;
          email: string;
          role: string;
        };

        req.user = {
          userId: userPayload.id,
          email: userPayload.email,
          role: userPayload.role
        };

        return next();
      } catch (error) {
        console.log('AccessToken verification failed, trying refreshToken...');
      }
    }
    
   
    if (refreshToken) {
      const user = await prisma.user.findFirst({
        where: { refreshToken }
      });

      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role
        };
        return next();
      }
    }
    
    
    res.status(401).json({ error: 'Access token not present, not authorized!' });
    
  } catch (error) {
    console.error('JWT verification failed:', error);
    res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
};

export const isSuperAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if(req.user && req.user.role === 'SUPER_ADMIN') {
    next()
  } else {
    res.status(403).json({success: false, err: "Access denied, Super admin required"})
  }
}