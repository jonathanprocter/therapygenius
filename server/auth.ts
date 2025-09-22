import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

// SECURITY: Enforce strong JWT secret at startup - no fallback allowed
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('[SECURITY FATAL] JWT_SECRET environment variable is required but not set');
    console.error('[SECURITY FATAL] Server cannot start without a secure JWT signing key');
    process.exit(1);
  }
  
  if (secret.length < 32) {
    console.error('[SECURITY FATAL] JWT_SECRET must be at least 32 characters long for security');
    console.error(`[SECURITY FATAL] Current length: ${secret.length}, minimum required: 32`);
    process.exit(1);
  }
  
  if (secret === "your-secret-key" || secret === "development" || secret === "test") {
    console.error('[SECURITY FATAL] JWT_SECRET cannot use default/common values');
    console.error('[SECURITY FATAL] Use a cryptographically secure random string');
    process.exit(1);
  }
  
  console.log('[SECURITY] JWT_SECRET validated successfully');
  return secret;
})();

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const user = await storage.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const requireAuth = authenticate;
