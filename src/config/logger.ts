import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Timezone formatter for Berlin time (Europe/Berlin)
const berlinTimezone = () => {
  return new Date().toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+):(\d+)\.(\d+)/, '$3-$1-$2 $4:$5:$6.$7');
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

// Create the main logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'windchill-mcp' },
  transports: [
    fileRotateTransport,
    errorFileRotateTransport,
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    })
  ],
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

// Create a specialized logger for API calls
export const apiLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'windchill-api' },
  transports: [
    apiFileRotateTransport,
    // Also log API calls to console in development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    })
  ]
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