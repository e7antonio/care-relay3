import { ConnectionInfo } from './types';

export class CommunicationService {
    private connections = new Map<string, ConnectionInfo>();
    private rooms = new Map<string, Set<string>>();

    // Gestión de conexiones
    addConnection(socketId: string): void {
        this.connections.set(socketId, {
            id: socketId,
            rooms: new Set<string>(),
            metadata: {},
            connectedAt: new Date()
        });
    }

    removeConnection(socketId: string): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            // Limpiar de todas las salas
            conn.rooms.forEach(roomName => {
                this.leaveRoom(socketId, roomName);
            });
        }
        this.connections.delete(socketId);
    }

    getConnection(socketId: string): ConnectionInfo | undefined {
        return this.connections.get(socketId);
    }

    getConnections(): ConnectionInfo[] {
        return Array.from(this.connections.values());
    }

    getConnectionsCount(): number {
        return this.connections.size;
    }

    // Gestión de salas
    joinRoom(socketId: string, roomName: string): void {
        const conn = this.connections.get(socketId);
        if (!conn) return;

        conn.rooms.add(roomName);

        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        this.rooms.get(roomName)!.add(socketId);
    }

    leaveRoom(socketId: string, roomName: string): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            conn.rooms.delete(roomName);
        }

        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName)!.delete(socketId);
            if (this.rooms.get(roomName)!.size === 0) {
                this.rooms.delete(roomName);
            }
        }
    }

    getRoomSize(roomName: string): number {
        return this.rooms.get(roomName)?.size || 0;
    }

    getRoomsInfo(): Array<{ name: string; userCount: number; users: string[] }> {
        return Array.from(this.rooms.entries()).map(([name, users]) => ({
            name: name,
            userCount: users.size,
            users: Array.from(users)
        }));
    }

    // Metadata
    updateMetadata(socketId: string, metadata: Record<string, unknown>): void {
        const conn = this.connections.get(socketId);
        if (conn) {
            conn.metadata = { ...conn.metadata, ...metadata };
        }
    }

    // Verificaciones
    hasConnection(socketId: string): boolean {
        return this.connections.has(socketId);
    }
} 