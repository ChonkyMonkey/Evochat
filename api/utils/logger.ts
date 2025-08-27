type LogFn = (...args: any[]) => void;

const withPrefix = (prefix: string, fn: LogFn): LogFn =>
  (...args) => fn(prefix, ...args);

const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase();

const levels = ['error', 'warn', 'info', 'debug'] as const;
const enabled: Record<typeof levels[number], boolean> = {
  error: true,
  warn:  level !== 'error',
  info:  !['error', 'warn'].includes(level),
  debug: level === 'debug',
};

const logger = {
  error: enabled.error ? withPrefix('[error]', console.error) : () => {},
  warn:  enabled.warn  ? withPrefix('[warn ]', console.warn)  : () => {},
  info:  enabled.info  ? withPrefix('[info ]', console.log)   : () => {},
  debug: enabled.debug ? withPrefix('[debug]', console.debug) : () => {},
};

export default logger;
