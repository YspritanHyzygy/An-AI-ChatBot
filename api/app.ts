/**
 * This is a API server
 */

// Load environment variables first, before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import chatRoutes from './routes/chat.js';
import providersRoutes from './routes/providers.js';


const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * API Routes
 */
app.use('/api/chat', chatRoutes);
app.use('/api/providers', providersRoutes);

/**
 * health
 */
app.use('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'ok'
  });
});

/**
 * error handler middleware
 */
app.use((_error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error'
  });
});

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;