// src/services/auth.service.ts
import prisma from '../prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '@prisma/client';
export class AuthService {
  // using global prisma singleton

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private validateEmail(email: string): boolean {
    // Simple email regex
    const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    return re.test(email);
  }

  private validatePassword(password: string): boolean {
    // Password strength: at least 8 chars, one number, one uppercase, one lowercase
    const re = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/;
    return re.test(password);
  }

  private toSafeUser(user: User) {
    const { password, ...safe } = user as any; // remove password hash
    return safe;
  }

  async register(email: string, password: string) {
    const normEmail = this.normalizeEmail(email);
    if (!this.validateEmail(normEmail)) {
      const err: any = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }
    if (!this.validatePassword(password)) {
      const err: any = new Error('Password does not meet strength requirements');
      err.statusCode = 400;
      throw err;
    }
    const existing = await prisma.user.findUnique({ where: { email: normEmail } });
    if (existing) {
      const err: any = new Error('Email already in use');
      err.statusCode = 409;
      throw err;
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normEmail,
        password: hashed,
      },
    });
    return this.toSafeUser(user);
  }

  async login(email: string, password: string) {
    const normEmail = this.normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normEmail } });
    if (!user) {
      const err: any = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const err: any = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }
    const payload = { userId: user.id };
    if (!env.jwtSecret) {
      const err: any = new Error('Missing JWT secret configuration');
      err.statusCode = 500;
      throw err;
    }
    const token = (jwt.sign as any)(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as string });
    return { token, user: this.toSafeUser(user) };
  }
}
