import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';

import targetsRouter from './routes/targets';
import runsRouter from './routes/runs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

export const prisma = new PrismaClient();

// Redis connection for BullMQ
const connection = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});
connection.on('error', (err) => console.error('Redis Client Error', err));
connection.connect();

export const jobQueue = new Queue('afw-jobs', { connection });

// Socket.IO namespace for live updates
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

app.use('/targets', targetsRouter);
app.use('/runs', runsRouter);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AFW API running on port ${PORT}`);
});