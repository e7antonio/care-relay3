/**
 * CircularBuffer - AlertaCare Domain Model
 * 
 * Fixed-size buffer that automatically overwrites oldest entries when full.
 * Optimized for streaming event data with chronological ordering.
 * 
 * @domain AlertaCare
 * @author AlertaCare Team
 */

class CircularBuffer {
    /**
     * Create a new CircularBuffer
     * @param {number} size - Fixed buffer size (default: 1080)
     */
    constructor(size = 1080) {
        this.size = size;
        this.buffer = new Array(size);
        this.index = 0;
        this.filled = false;
        this.count = 0;
        this.createdAt = new Date().toISOString();
    }

    /**
     * Add new item to buffer with automatic metadata injection
     * @param {Object} item - Event data to store
     * @returns {Object} Stored item with metadata
     */
    push(item) {
        const enrichedItem = {
            ...item,
            _buffered_at: new Date().toISOString(),
            _buffer_index: this.count
        };

        this.buffer[this.index] = enrichedItem;
        this.index = (this.index + 1) % this.size;
        this.count++;
        
        if (this.index === 0) {
            this.filled = true;
        }

        return enrichedItem;
    }

    /**
     * Get all events in chronological order (oldest to newest)
     * @returns {Array} All events in buffer
     */
    getAll() {
        if (!this.filled) {
            return this.buffer.slice(0, this.index).filter(item => item !== undefined);
        }
        
        // Return in chronological order: oldest to newest
        return this.buffer.slice(this.index)
            .concat(this.buffer.slice(0, this.index))
            .filter(item => item !== undefined);
    }

    /**
     * Get latest N events
     * @param {number} count - Number of recent events to retrieve
     * @returns {Array} Latest events
     */
    getLatest(count = 10) {
        const all = this.getAll();
        return all.slice(-count);
    }

    /**
     * Get current buffer utilization
     * @returns {number} Current number of events stored
     */
    getCurrentSize() {
        return this.filled ? this.size : this.index;
    }

    /**
     * Get buffer statistics
     * @returns {Object} Buffer stats
     */
    getStats() {
        return {
            capacity: this.size,
            currentSize: this.getCurrentSize(),
            totalProcessed: this.count,
            utilizationPercentage: (this.getCurrentSize() / this.size) * 100,
            isFull: this.filled,
            createdAt: this.createdAt,
            oldestEventIndex: this.filled ? this.index : 0
        };
    }

    /**
     * Clear all buffer contents
     */
    clear() {
        this.buffer = new Array(this.size);
        this.index = 0;
        this.filled = false;
        this.count = 0;
    }

    /**
     * Check if buffer is empty
     * @returns {boolean} True if buffer is empty
     */
    isEmpty() {
        return this.index === 0 && !this.filled;
    }

    /**
     * Check if buffer is full
     * @returns {boolean} True if buffer is full
     */
    isFull() {
        return this.filled;
    }
}

module.exports = CircularBuffer; 