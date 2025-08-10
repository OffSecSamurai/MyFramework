import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import { Server } from 'socket.io';
import runsRouter from './routes/runs.js';
import targetsRouter from './routes/targets.js';
import artifactsRouter from './routes/artifacts.js';
import vulnsRouter from './routes/vulns.js';

const apiPort = Number(process.env.API_PORT || 4000);

const app = express();
app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const server = http.createServer(app);
const io = new Server(server, {
  path: process.env.SOCKET_PATH || '/socket.io',
  cors: { origin: '*'}
});

io.on('connection', (socket) => {
  socket.on('progress', (payload) => {
    io.emit('progress', payload);
  });
});

app.set('io', io);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/runs', runsRouter);
app.use('/api/targets', targetsRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/vulns', vulnsRouter);

server.listen(apiPort, () => {
  console.log(`[API] listening on :${apiPort}`);
});