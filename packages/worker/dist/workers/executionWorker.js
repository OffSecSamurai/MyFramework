"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupExecutionWorker = void 0;
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
exports.setupExecutionWorker = {
    async handleJob(job) {
        try {
            const { executionId, targetId, mode, tools } = job.data;
            logger_1.logger.info(`Starting execution: ${executionId} for target: ${targetId}`);
            await index_1.prisma.execution.update({
                where: { id: executionId },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date()
                }
            });
            const tasks = [];
            for (const tool of tools) {
                const task = await index_1.prisma.task.create({
                    data: {
                        executionId,
                        tool,
                        status: 'PENDING'
                    }
                });
                tasks.push(task);
            }
            await index_1.prisma.execution.update({
                where: { id: executionId },
                data: {
                    metadata: JSON.stringify({
                        totalTasks: tasks.length,
                        completedTasks: 0,
                        failedTasks: 0
                    })
                }
            });
            logger_1.logger.info(`Created ${tasks.length} tasks for execution: ${executionId}`);
            return { success: true, taskCount: tasks.length };
        }
        catch (error) {
            logger_1.logger.error(`Execution job failed:`, error);
            if (job.data.executionId) {
                await index_1.prisma.execution.update({
                    where: { id: job.data.executionId },
                    data: {
                        status: 'FAILED',
                        completedAt: new Date()
                    }
                });
            }
            throw error;
        }
    }
};
//# sourceMappingURL=executionWorker.js.map