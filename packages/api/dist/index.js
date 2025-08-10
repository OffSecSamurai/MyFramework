"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const targets_1 = __importDefault(require("./routes/targets"));
const executions_1 = __importDefault(require("./routes/executions"));
const artifacts_1 = __importDefault(require("./routes/artifacts"));
const vulnerabilities_1 = __importDefault(require("./routes/vulnerabilities"));
const reports_1 = __importDefault(require("./routes/reports"));
const websocket_1 = require("./services/websocket");
const queue_1 = require("./services/queue");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env['CORS_ORIGIN'] || "http://localhost:3000",
    credentials: true
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use('/api/targets', targets_1.default);
app.use('/api/executions', executions_1.default);
app.use('/api/artifacts', artifacts_1.default);
app.use('/api/vulnerabilities', vulnerabilities_1.default);
app.use('/api/reports', reports_1.default);
app.use(errorHandler_1.errorHandler);
(0, websocket_1.setupWebSocket)(io);
(0, queue_1.setupQueue)();
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
    });
    await exports.prisma.$disconnect();
    logger_1.logger.info('Database connection closed');
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const PORT = parseInt(process.env['PORT'] || '3001');
const HOST = process.env['HOST'] || '0.0.0.0';
server.listen(PORT, HOST, () => {
    logger_1.logger.info(`🚀 Akshay's Framework API server running on http://${HOST}:${PORT}`);
    logger_1.logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`);
});
//# sourceMappingURL=index.js.map