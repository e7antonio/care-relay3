// Tipos para mensajería general
export interface ConnectionInfo {
    id: string;
    rooms: Set<string>;
    metadata: Record<string, unknown>;
    connectedAt: Date;
}

export interface PrivateMessage {
    targetId: string;
    message: any;
}

export interface RoomMessage {
    room: string;
    message: any;
}

export interface UserJoinedRoom {
    userId: string;
    room: string;
    roomSize: number;
}

export interface UserLeftRoom {
    userId: string;
    room: string;
    roomSize: number;
}

export interface BroadcastData {
    from: string;
    data: any;
    timestamp: Date;
} 