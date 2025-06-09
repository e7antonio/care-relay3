/**
 * Connection - Communication Context Domain Model
 * 
 * Representa una conexión de cliente en el sistema de comunicación.
 * Entidad del dominio con estado y comportamiento específico.
 * 
 * @domain Communication
 * @author AlertaCare Team
 */

class Connection {
    /**
     * Create a new Connection
     * @param {string} socketId - Unique socket identifier
     * @param {Object} metadata - Connection metadata
     */
    constructor(socketId, metadata = {}) {
        this.socketId = socketId;
        this.metadata = metadata;
        this.rooms = new Set();
        this.connectedAt = new Date();
        this.lastActivity = new Date();
        this.isActive = true;
    }

    /**
     * Update connection metadata
     * @param {Object} newMetadata - New metadata to merge
     */
    updateMetadata(newMetadata) {
        this.metadata = { ...this.metadata, ...newMetadata };
        this.lastActivity = new Date();
    }

    /**
     * Join a room
     * @param {string} roomName - Room name to join
     */
    joinRoom(roomName) {
        this.rooms.add(roomName);
        this.lastActivity = new Date();
    }

    /**
     * Leave a room
     * @param {string} roomName - Room name to leave
     */
    leaveRoom(roomName) {
        this.rooms.delete(roomName);
        this.lastActivity = new Date();
    }

    /**
     * Leave all rooms
     */
    leaveAllRooms() {
        const roomsToLeave = Array.from(this.rooms);
        this.rooms.clear();
        this.lastActivity = new Date();
        return roomsToLeave;
    }

    /**
     * Update activity timestamp
     */
    updateActivity() {
        this.lastActivity = new Date();
    }

    /**
     * Mark connection as disconnected
     */
    disconnect() {
        this.isActive = false;
        this.disconnectedAt = new Date();
    }

    /**
     * Get connection duration in seconds
     * @returns {number} Duration in seconds
     */
    getDurationSeconds() {
        const endTime = this.isActive ? new Date() : this.disconnectedAt;
        return Math.round((endTime - this.connectedAt) / 1000);
    }

    /**
     * Get idle time in seconds
     * @returns {number} Seconds since last activity
     */
    getIdleSeconds() {
        return Math.round((new Date() - this.lastActivity) / 1000);
    }

    /**
     * Check if connection is in specific room
     * @param {string} roomName - Room name to check
     * @returns {boolean} True if in room
     */
    isInRoom(roomName) {
        return this.rooms.has(roomName);
    }

    /**
     * Get list of rooms
     * @returns {Array} Array of room names
     */
    getRooms() {
        return Array.from(this.rooms);
    }

    /**
     * Get connection summary
     * @returns {Object} Connection information
     */
    getInfo() {
        return {
            socketId: this.socketId,
            metadata: this.metadata,
            rooms: this.getRooms(),
            connectedAt: this.connectedAt,
            lastActivity: this.lastActivity,
            durationSeconds: this.getDurationSeconds(),
            idleSeconds: this.getIdleSeconds(),
            isActive: this.isActive,
            roomCount: this.rooms.size
        };
    }

    /**
     * Validate connection state
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.socketId || this.socketId.trim() === '') {
            errors.push('socketId is required');
        }

        if (this.lastActivity < this.connectedAt) {
            errors.push('lastActivity cannot be before connectedAt');
        }

        if (!this.isActive && !this.disconnectedAt) {
            errors.push('disconnectedAt is required when isActive is false');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Create Connection from plain object
     * @param {Object} data - Plain object data
     * @returns {Connection} Connection instance
     */
    static fromObject(data) {
        const connection = new Connection(data.socketId, data.metadata);
        
        if (data.rooms) {
            data.rooms.forEach(room => connection.joinRoom(room));
        }
        
        if (data.connectedAt) connection.connectedAt = new Date(data.connectedAt);
        if (data.lastActivity) connection.lastActivity = new Date(data.lastActivity);
        if (data.isActive !== undefined) connection.isActive = data.isActive;
        if (data.disconnectedAt) connection.disconnectedAt = new Date(data.disconnectedAt);

        return connection;
    }

    /**
     * Convert to plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            socketId: this.socketId,
            metadata: this.metadata,
            rooms: this.getRooms(),
            connectedAt: this.connectedAt.toISOString(),
            lastActivity: this.lastActivity.toISOString(),
            isActive: this.isActive,
            ...(this.disconnectedAt && { disconnectedAt: this.disconnectedAt.toISOString() })
        };
    }
}

module.exports = Connection; 