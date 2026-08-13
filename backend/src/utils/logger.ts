function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function build(level: 'INFO' | 'WARN' | 'ERROR', module: string, message: string, args: unknown[]): unknown[] {
  return [`[${fmtTime(new Date())}] [${level}] [${module}] ${message}`, ...args];
}

export const logger = {
  info(module: string, message: string, ...args: unknown[]): void {
    console.log(...build('INFO', module, message, args));
  },
  warn(module: string, message: string, ...args: unknown[]): void {
    console.warn(...build('WARN', module, message, args));
  },
  error(module: string, message: string, ...args: unknown[]): void {
    console.error(...build('ERROR', module, message, args));
  },
};