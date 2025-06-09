// Tipos para Support Management
export interface ServerStats {
    totalConnections: number;
    totalRooms: number;
    alertaCareChannels: Record<string, number>;
    uptime: number;
    timestamp: Date;
    version: string;
}

export interface HealthStatus {
    status: 'ok' | 'warning' | 'error';
    timestamp: Date;
    version: string;
    uptime: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
}

export interface SystemInfo {
    nodeVersion: string;
    platform: string;
    architecture: string;
    hostname: string;
    pid: number;
}

export interface LogLevel {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
    context?: string;
}

export interface MetricsData {
    connections: {
        current: number;
        total: number;
        peak: number;
    };
    rooms: {
        current: number;
        total: number;
    };
    alertacare: {
        channels: number;
        totalEvents: number;
    };
    performance: {
        uptime: number;
        memoryUsage: NodeJS.MemoryUsage;
    };
} 