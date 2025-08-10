import { Express } from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

export {};