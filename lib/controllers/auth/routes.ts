import type { Request, Response } from "express";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import prisma from "../../prisma.js";


export const generateAccessTokens = (id: string, email: string, role: string) => {
   
  const accessToken = jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" } 
  );

  const refreshToken = randomUUID()

  return { accessToken, refreshToken };
};

const setToken = async (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Changed!
    maxAge: 1000 * 60 * 15 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', 
    maxAge: 1000 * 60 * 60 * 24 * 7 
  });
};


export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      res.status(400).json({ 
        success: false,
        error: `User with email ${email} already exists`
       });
      return; 
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
}


export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: `User does not exist`
      });
      return;
    }
    
    console.log('Comparing passwords...');
    const isMatch = bcrypt.compareSync(password, user.password);
    
    if (!isMatch) {
      res.status(400).json({
        success: false,
        error: "Invalid email or password"
      });
      return;
    }
    
    const { accessToken, refreshToken } = generateAccessTokens(user.id, user.email, user.role);
    
    // ✅ IMPORTANT: Save refreshToken to database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });
    
    await setToken(res, accessToken, refreshToken);
    
    res.status(200).json({
      success: true,
      message: "Logged in successfully!",
      accessToken: accessToken, 
      user: {
        name: user.name,
        email: user.email,
        id: user.id,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: "Something went wrong"
    });
  }
}
export const refreshAccessToken = async(req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if(!refreshToken) {
    res.status(404).json({
      success: false,
      error: "Invalid refresh Token"
    })
    return;
  }
  
  try {
    const user = await prisma.user.findFirst({
      where: {refreshToken}
    })
    
    if(!user) {
      res.status(401).json({
        success: false,
        error: 'User not found'
      })
      return
    }
    
    const {accessToken, refreshToken: newRefreshToken} = generateAccessTokens(user.id, user.email, user.role)
    
    // Update refreshToken in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    });
    
    await setToken(res, accessToken, newRefreshToken)
    
    res.status(200).json({
      success: true,
      message: "Refreshed Token successfully!"
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      success: false,
      error: "Failed to refresh token"
    })
  }
};

export const logout = async(req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    // Clear refreshToken from database
    if (refreshToken) {
      await prisma.user.updateMany({
        where: { refreshToken },
        data: { refreshToken: null }
      });
    }
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: "User logged out successfully!"
    });
  } catch (error) {
    console.log('Logout error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to logout"
    });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany();
    
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      });
    }
    
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}