/**
 * Logging system for the procedural world engine
 * 
 * Provides configurable logging with different levels and categories.
 * In production, logs can be disabled or filtered by level.
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // Disable all logging
}

/**
 * Log categories for filtering
 */
export enum LogCategory {
  CHUNK = 'Chunk',
  LAKE = 'Lake',
  WORKER = 'Worker',
  CACHE = 'Cache',
  PERFORMANCE = 'Performance',
  GENERAL = 'General',
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  level: LogLevel;
  /** Enable/disable specific categories */
  categories?: Set<LogCategory>;
  /** Enable timestamps in logs */
  timestamps?: boolean;
  /** Custom log handler (for sending to external service) */
  handler?: (level: LogLevel, category: LogCategory, message: string, data?: any) => void;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.WARN, // Only warnings and errors in production
  timestamps: false,
};

/**
 * Logger class for structured logging
 */
class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a log should be displayed
   */
  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    // Check log level
    if (level < this.config.level) {
      return false;
    }

    // Check category filter
    if (this.config.categories && !this.config.categories.has(category)) {
      return false;
    }

    return true;
  }

  /**
   * Format log message
   */
  private format(level: LogLevel, category: LogCategory, message: string): string {
    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.config.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    // Add level
    const levelName = LogLevel[level];
    parts.push(`[${levelName}]`);

    // Add category
    parts.push(`[${category}]`);

    // Add message
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Log a debug message
   */
  debug(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG, category)) return;

    const formatted = this.format(LogLevel.DEBUG, category, message);

    if (this.config.handler) {
      this.config.handler(LogLevel.DEBUG, category, message, data);
    } else {
      if (data !== undefined) {
        console.debug(formatted, data);
      } else {
        console.debug(formatted);
      }
    }
  }

  /**
   * Log an info message
   */
  info(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO, category)) return;

    const formatted = this.format(LogLevel.INFO, category, message);

    if (this.config.handler) {
      this.config.handler(LogLevel.INFO, category, message, data);
    } else {
      if (data !== undefined) {
        console.info(formatted, data);
      } else {
        console.info(formatted);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN, category)) return;

    const formatted = this.format(LogLevel.WARN, category, message);

    if (this.config.handler) {
      this.config.handler(LogLevel.WARN, category, message, data);
    } else {
      if (data !== undefined) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    }
  }

  /**
   * Log an error message
   */
  error(category: LogCategory, message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.ERROR, category)) return;

    const formatted = this.format(LogLevel.ERROR, category, message);

    if (this.config.handler) {
      this.config.handler(LogLevel.ERROR, category, message, data);
    } else {
      if (data !== undefined) {
        console.error(formatted, data);
      } else {
        console.error(formatted);
      }
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Configure the global logger
 * 
 * @example
 * ```typescript
 * // Enable debug logging for development
 * configureLogger({ level: LogLevel.DEBUG });
 * 
 * // Enable only specific categories
 * configureLogger({
 *   level: LogLevel.INFO,
 *   categories: new Set([LogCategory.CHUNK, LogCategory.LAKE])
 * });
 * 
 * // Disable all logging for production
 * configureLogger({ level: LogLevel.NONE });
 * ```
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.configure(config);
}
