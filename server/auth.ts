import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key-change-in-production";
const SALT_ROUNDS = 10;

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  req.user = payload;
  next();
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
