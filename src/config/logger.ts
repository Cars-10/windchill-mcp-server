import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory in the project root (two levels up from src/config)
const projectRoot = path.resolve(__dirname, '..', '..');
const logsDir = path.join(projectRoot, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Timezone formatter for Berlin time (Europe/Berlin)
const berlinTimezone = () => {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return formatted.replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)/, `$3-$1-$2 $4:$5:$6.${ms}`);
};

// Custom format for log messages
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: berlinTimezone }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }

    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }

    return logMessage;
  })
);

// Console format (simpler for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: () => {
      return new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Berlin',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    return logMessage;
  })
);

// Create daily rotate file transport for all logs
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'windchill-mcp-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep logs for 14 days
  format: logFormat,
  level: process.env.LOG_LEVEL || 'info'
});

// Create daily rotate file transport for error logs only
const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'windchill-mcp-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep error logs for 30 days
  format: logFormat,
  level: 'error'
});

// Create daily rotate file transport for API calls
const apiFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'windchill-api-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d', // Keep API logs for 7 days
  format: logFormat,
  level: 'debug'
});

// Check if running in stdio-only mode (for Claude Desktop)
const STDIO_ONLY = process.env.MCP_STDIO_ONLY === 'true';

// Configure transports based on mode
const transports: winston.transport[] = [
  fileRotateTransport,
  errorFileRotateTransport
];

// Only add console transport if not in stdio-only mode
if (!STDIO_ONLY) {
  transports.push(
    // Console transport for development - MUST use stderr for MCP protocol compliance
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'] // Force all to stderr
    })
  );
}

// Create the main logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'windchill-mcp' },
  transports,
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    })
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    })
  ]
});

// Configure API logger transports based on mode
const apiTransports: winston.transport[] = [apiFileRotateTransport];

// Only add console transport if not in stdio-only mode
if (!STDIO_ONLY) {
  apiTransports.push(
    // Also log API calls to console in development - MUST use stderr for MCP protocol
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'] // Force all to stderr
    })
  );
}

// Create a specialized logger for API calls
export const apiLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'windchill-api' },
  transports: apiTransports
});

// Log startup information
logger.info('Logging system initialized', {
  logsDirectory: logsDir,
  logLevel: process.env.LOG_LEVEL || 'info',
  environment: process.env.NODE_ENV || 'development'
});

// Handle log rotation events
fileRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFile: oldFilename, newFile: newFilename });
});

fileRotateTransport.on('archive', (zipFilename) => {
  logger.info('Log file archived', { archiveFile: zipFilename });
});

export default logger;