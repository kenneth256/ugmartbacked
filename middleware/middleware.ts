import type { Request, Response, NextFunction } from "express";
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
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
    
    // Try to verify access token first
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

        console.log('AccessToken verified successfully');
        return next();
      } catch (error) {
        console.log('AccessToken verification failed, trying refreshToken...');
      }
    }
    
    // If access token is invalid/expired, try refresh token
    if (refreshToken) {
      try {
        const user = await prisma.user.findFirst({
          where: { refreshToken }
        });

        if (user) {
          console.log('RefreshToken verified, generating new accessToken...');
          
          // Set user on request
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role
          };

          // Generate NEW access token
          const secret = process.env.JWT_SECRET;
          if (!secret) {
            throw new Error('JWT_SECRET is not defined');
          }

          const newAccessToken = await new SignJWT({
            id: user.id,
            email: user.email,
            role: user.role
          })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('15m') // 15 minutes
            .setIssuedAt()
            .sign(new TextEncoder().encode(secret));

          // Set new access token cookie
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Changed from 'strict' for better compatibility
            maxAge: 15 * 60 * 1000 // 15 minutes
          });

          console.log('New accessToken generated and set');
          return next();
        } else {
          console.log('RefreshToken not found in database');
        }
      } catch (error) {
        console.error('RefreshToken verification failed:', error);
      }
    }
    
    // If both tokens fail, return unauthorized
    console.log('Authentication failed - no valid tokens');
    res.status(401).json({ 
      success: false, 
      error: 'Unauthorized access denied' 
    });
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired access token' 
    });
  }
};

export const isSuperAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if(req.user && req.user.role === 'SUPER_ADMIN') {
    next()
  } else {
    res.status(403).json({
      success: false, 
      error: "Access denied, Super admin required"
    })
  }
}