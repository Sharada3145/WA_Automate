// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.register(email, password);
    return res.status(201).json({ success: true, user: result });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { token, user } = await authService.login(email, password);
    // Return token in response body; client can store as needed.
    return res.json({ success: true, token, user });
  } catch (err: any) {
    const status = err.statusCode || 401;
    return res.status(status).json({ success: false, message: err.message });
  }
};

export const me = async (req: Request, res: Response) => {
  // auth middleware attaches req.user
  const user = (req as any).user;
  return res.json({ success: true, user });
};

export const logout = async (_req: Request, res: Response) => {
  // Stateless JWT – instruct client to delete token
  return res.json({ success: true, message: 'Logged out. Delete token on client side.' });
};

export default { register, login, me, logout };
