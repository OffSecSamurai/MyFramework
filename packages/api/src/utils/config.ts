import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables
dotenvConfig();

interface AppConfig {
  // Server configuration
  port: number;
  host: string;
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;

  // Database configuration
  database: {
    url: string;
  };

  // Redis configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    url: string;
  };

  // Security configuration
  security: {
    jwtSecret: string;
    sessionSecret: string;
    sessionMaxAge: number;
  };

  // CORS configuration
  cors: {
    origin: string | string[];
  };

  // Rate limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };

  // Worker configuration
  worker: {
    concurrency: number;
    maxThreads: number;
    timeout: number;
    jobAttempts: number;
    backoff: string;
  };

  // Storage configuration
  storage: {
    basePath: string;
    artifactsPath: string;
    reportsPath: string;
    tempPath: string;
  };

  // Tool configuration
  tools: {
    useNative: boolean;
    dockerFallback: boolean;
    timeout: number;
    dockerHost?: string;
    dockerRegistry?: string;
  };

  // Proxy configuration
  proxy: {
    burp: {
      host?: string;
      port: number;
      enabled: boolean;
    };
    zap: {
      host?: string;
      port: number;
      enabled: boolean;
    };
  };

  // VM integration paths
  vm: {
    kali: {
      mountPath: string;
      toolsPath: string;
    };
    windows: {
      burpPath: string;
      firefoxPath: string;
    };
  };

  // Logging configuration
  logging: {
    level: string;
    file: string;
    maxSize: string;
    maxFiles: number;
  };

  // Hardware optimization
  hardware: {
    maxCpuCores: number;
    maxMemoryMB: number;
    concurrentScans: number;
    batchSize: number;
    enableSsdOptimization: boolean;
    tempCleanupInterval: number;
    enableGpuAcceleration: boolean;
  };

  // API Keys
  apiKeys: {
    chaos?: string;
    shodan?: string;
    virustotal?: string;
    securitytrails?: string;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  const parsed = value ? parseInt(value, 10) : defaultValue!;
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getCorsOrigin(): string | string[] {
  const origin = getEnvVar('CORS_ORIGIN', 'http://localhost:3000');
  if (origin.includes(',')) {
    return origin.split(',').map(o => o.trim());
  }
  return origin;
}

// Create configuration object
export const config: AppConfig = {
  // Server configuration
  port: getEnvNumber('API_PORT', 3001),
  host: getEnvVar('API_HOST', '0.0.0.0'),
  environment: getEnvVar('NODE_ENV', 'development'),
  isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',
  isProduction: getEnvVar('NODE_ENV', 'development') === 'production',

  // Database configuration
  database: {
    url: getEnvVar('DATABASE_URL')
  },

  // Redis configuration
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
    db: getEnvNumber('REDIS_DB', 0),
    url: getEnvVar('REDIS_URL', 'redis://localhost:6379')
  },

  // Security configuration
  security: {
    jwtSecret: getEnvVar('API_SECRET_KEY'),
    sessionSecret: getEnvVar('SESSION_SECRET'),
    sessionMaxAge: getEnvNumber('SESSION_MAX_AGE', 86400000) // 24 hours
  },

  // CORS configuration
  cors: {
    origin: getCorsOrigin()
  },

  // Rate limiting
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
  },

  // Worker configuration
  worker: {
    concurrency: getEnvNumber('WORKER_CONCURRENCY', 5),
    maxThreads: getEnvNumber('MAX_THREADS', 50),
    timeout: getEnvNumber('WORKER_TIMEOUT', 3600000), // 1 hour
    jobAttempts: getEnvNumber('JOB_ATTEMPTS', 3),
    backoff: getEnvVar('JOB_BACKOFF', 'exponential')
  },

  // Storage configuration
  storage: {
    basePath: path.resolve(getEnvVar('STORAGE_PATH', './storage')),
    artifactsPath: path.resolve(getEnvVar('ARTIFACTS_PATH', './storage/artifacts')),
    reportsPath: path.resolve(getEnvVar('REPORTS_PATH', './storage/reports')),
    tempPath: path.resolve(getEnvVar('TEMP_PATH', './storage/temp'))
  },

  // Tool configuration
  tools: {
    useNative: getEnvBoolean('USE_NATIVE_TOOLS', true),
    dockerFallback: getEnvBoolean('DOCKER_FALLBACK', true),
    timeout: getEnvNumber('TOOL_TIMEOUT', 1800), // 30 minutes
    dockerHost: process.env.DOCKER_HOST,
    dockerRegistry: process.env.DOCKER_REGISTRY
  },

  // Proxy configuration
  proxy: {
    burp: {
      host: process.env.BURP_PROXY_HOST,
      port: getEnvNumber('BURP_PROXY_PORT', 8080),
      enabled: getEnvBoolean('BURP_PROXY_ENABLED', false)
    },
    zap: {
      host: process.env.ZAP_PROXY_HOST,
      port: getEnvNumber('ZAP_PROXY_PORT', 8081),
      enabled: getEnvBoolean('ZAP_PROXY_ENABLED', false)
    }
  },

  // VM integration paths
  vm: {
    kali: {
      mountPath: getEnvVar('KALI_VM_MOUNT_PATH', '/mnt/shared'),
      toolsPath: getEnvVar('KALI_TOOLS_PATH', '/usr/bin')
    },
    windows: {
      burpPath: getEnvVar('WINDOWS_VM_BURP_PATH', 'C:\\Program Files\\BurpSuitePro'),
      firefoxPath: getEnvVar('WINDOWS_VM_FIREFOX_PATH', 'C:\\Program Files\\Mozilla Firefox')
    }
  },

  // Logging configuration
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    file: getEnvVar('LOG_FILE', './logs/app.log'),
    maxSize: getEnvVar('LOG_MAX_SIZE', '10m'),
    maxFiles: getEnvNumber('LOG_MAX_FILES', 5)
  },

  // Hardware optimization
  hardware: {
    maxCpuCores: getEnvNumber('MAX_CPU_CORES', 8),
    maxMemoryMB: getEnvNumber('MAX_MEMORY_MB', 12288), // 12GB
    concurrentScans: getEnvNumber('CONCURRENT_SCANS', 3),
    batchSize: getEnvNumber('BATCH_SIZE', 1000),
    enableSsdOptimization: getEnvBoolean('ENABLE_SSD_OPTIMIZATION', true),
    tempCleanupInterval: getEnvNumber('TEMP_CLEANUP_INTERVAL', 3600), // 1 hour
    enableGpuAcceleration: getEnvBoolean('ENABLE_GPU_ACCELERATION', false)
  },

  // API Keys
  apiKeys: {
    chaos: process.env.CHAOS_API_KEY,
    shodan: process.env.SHODAN_API_KEY,
    virustotal: process.env.VIRUSTOTAL_API_KEY,
    securitytrails: process.env.SECURITYTRAILS_API_KEY
  }
};

// Validate critical configuration
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required environment variables
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.security.jwtSecret) {
    errors.push('API_SECRET_KEY is required');
  }

  if (!config.security.sessionSecret) {
    errors.push('SESSION_SECRET is required');
  }

  // Validate port ranges
  if (config.port < 1 || config.port > 65535) {
    errors.push('API_PORT must be between 1 and 65535');
  }

  if (config.redis.port < 1 || config.redis.port > 65535) {
    errors.push('REDIS_PORT must be between 1 and 65535');
  }

  // Validate thread limits
  if (config.worker.maxThreads > 100) {
    console.warn('⚠️  MAX_THREADS is set to', config.worker.maxThreads, '- this may overload your system');
  }

  // Validate memory limits
  if (config.hardware.maxMemoryMB > 16384) {
    console.warn('⚠️  MAX_MEMORY_MB is set to', config.hardware.maxMemoryMB, 'MB - this exceeds your 16GB system RAM');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Log configuration summary
export function logConfigSummary(): void {
  console.log('🔧 Akshay\'s Framework Configuration Summary:');
  console.log(`   Environment: ${config.environment}`);
  console.log(`   API Server: ${config.host}:${config.port}`);
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`   Max Threads: ${config.worker.maxThreads}`);
  console.log(`   Max Memory: ${config.hardware.maxMemoryMB}MB`);
  console.log(`   Storage: ${config.storage.basePath}`);
  console.log(`   Native Tools: ${config.tools.useNative ? 'Enabled' : 'Disabled'}`);
  console.log(`   Docker Fallback: ${config.tools.dockerFallback ? 'Enabled' : 'Disabled'}`);
  
  if (config.proxy.burp.enabled) {
    console.log(`   Burp Proxy: ${config.proxy.burp.host}:${config.proxy.burp.port}`);
  }
  
  if (config.proxy.zap.enabled) {
    console.log(`   ZAP Proxy: ${config.proxy.zap.host}:${config.proxy.zap.port}`);
  }
}