import * as util from 'util';

export class Logger {
    // Numeric levels: lower = more verbose
    private static readonly LEVELS: Record<string, number> = {
        DEBUG: 10,
        INFO: 20,
        WARN: 30,
        ERROR: 40,
        FATAL: 50,
        OFF: 100
    };

    private static currentLevel: number = Logger.parseLevel(process.env.LOG_LEVEL || 'INFO');

    // Allow setting level at runtime
    public static setLevel(levelName: string) {
        Logger.currentLevel = Logger.parseLevel(levelName);
    }

    public static getLevel(): string {
        for (const k of Object.keys(Logger.LEVELS)) {
            if (Logger.LEVELS[k] === Logger.currentLevel) return k;
        }
        return 'CUSTOM';
    }

    private static parseLevel(levelName?: string): number {
        if (!levelName) return Logger.LEVELS.INFO;
        const key = levelName.toUpperCase();
        return Logger.LEVELS[key] ?? Logger.LEVELS.INFO;
    }

    private static isEnabled(levelName: string): boolean {
        const key = (levelName || '').toUpperCase();
        const val = Logger.LEVELS[key];
        if (val === undefined) return true; // unknown levels allowed
        return val >= Logger.currentLevel;
    }

    private static safeString(val: any): string {
        if (val === null || val === undefined) return String(val);
        if (typeof val === 'string') return val;
        try {
            return util.inspect(val, { depth: 2, colors: false });
        } catch (e) {
            try { return JSON.stringify(val); } catch (_) { return String(val); }
        }
    }

    private static formatMessage(message: any): string {
        if (typeof message === 'function') {
            try {
                return Logger.safeString((message as Function)());
            } catch (e) {
                return `<<log message function threw: ${e}>>`;
            }
        }
        return Logger.safeString(message);
    }

    private static write(levelName: string, file: string, task: string, message: any) {
        if (!Logger.isEnabled(levelName)) return;
        const timestamp = new Date().toISOString();
        const body = Logger.formatMessage(message);
        const out = `${timestamp} - ${levelName.toUpperCase()} - ${file} - ${task} - ${body}`;
        switch (levelName.toUpperCase()) {
            case 'DEBUG':
                console.debug ? console.debug(out) : console.log(out);
                break;
            case 'INFO':
                console.info ? console.info(out) : console.log(out);
                break;
            case 'WARN':
                console.warn ? console.warn(out) : console.log(out);
                break;
            default:
                console.error ? console.error(out) : console.log(out);
                break;
        }
    }

    // Backwards-compatible generic log
    public static log(file: string, log_level: string, task: string, message: any) {
        Logger.write(log_level, file, task, message);
    }

    public static logError(file: string, task: string, message: any | (() => any)) {
        Logger.write('ERROR', file, task, message);
    }

    public static logDebug(file: string, task: string, message: any | (() => any)) {
        Logger.write('DEBUG', file, task, message);
    }

    public static logWarn(file: string, task: string, message: any | (() => any)) {
        Logger.write('WARN', file, task, message);
    }

    public static logFatal(file: string, task: string, message: any | (() => any)) {
        Logger.write('FATAL', file, task, message);
    }

    public static logInfo(file: string, task: string, message: any | (() => any)) {
        Logger.write('INFO', file, task, message);
    }
}
