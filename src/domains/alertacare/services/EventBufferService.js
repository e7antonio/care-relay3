/**
 * EventBufferService - AlertaCare Domain Service
 * 
 * Core business logic for managing event buffers and channels.
 * Handles storage, retrieval, and management of streaming events.
 * 
 * @domain AlertaCare
 * @author AlertaCare Team
 */

const CircularBuffer = require('../models/CircularBuffer');
const ChannelKey = require('../models/ChannelKey');

class EventBufferService {
    /**
     * Create EventBufferService instance
     * @param {Object} config - Service configuration
     */
    constructor(config = {}) {
        this.defaultBufferSize = config.bufferSize || 1080;
        this.buffers = new Map(); // channelKey -> CircularBuffer
        this.stats = {
            totalEvents: 0,
            channelsCreated: 0,
            startTime: new Date().toISOString()
        };
    }

    /**
     * Store event in appropriate channel buffer
     * @param {Object} metadata - Channel metadata
     * @param {Object} event - Event data to store
     * @returns {Object} Result with success status and details
     */
    storeEvent(metadata, event) {
        try {
            const channelKey = new ChannelKey(metadata);
            const keyString = channelKey.toString();
            
            // Create buffer if it doesn't exist
            if (!this.buffers.has(keyString)) {
                this._createBuffer(keyString);
            }

            // Enrich event with metadata
            const enrichedEvent = {
                ...event,
                _meta: channelKey.getComponents(),
                _timestamp: new Date().toISOString(),
                _channel: keyString
            };

            // Store in buffer
            const buffer = this.buffers.get(keyString);
            const storedEvent = buffer.push(enrichedEvent);
            
            // Update stats
            this.stats.totalEvents++;

            console.log(`✅ Event stored in channel: ${keyString}`);
            
            return {
                success: true,
                channel: keyString,
                event: storedEvent,
                bufferStats: buffer.getStats()
            };

        } catch (error) {
            console.error(`❌ Error storing event:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Retrieve events from channel buffer
     * @param {Object} metadata - Channel metadata
     * @param {Object} options - Retrieval options
     * @returns {Object} Result with events and metadata
     */
    getEvents(metadata, options = {}) {
        try {
            const channelKey = new ChannelKey(metadata);
            const keyString = channelKey.toString();
            
            const buffer = this.buffers.get(keyString);
            
            if (!buffer) {
                return {
                    success: true,
                    channel: keyString,
                    events: [],
                    eventCount: 0,
                    message: 'Channel not found or empty'
                };
            }

            // Get events based on options
            let events;
            if (options.latest && typeof options.latest === 'number') {
                events = buffer.getLatest(options.latest);
            } else {
                events = buffer.getAll();
            }

            return {
                success: true,
                channel: keyString,
                events: events,
                eventCount: events.length,
                bufferStats: buffer.getStats()
            };

        } catch (error) {
            console.error(`❌ Error retrieving events:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get information about all available channels
     * @returns {Object} Channels information
     */
    getChannelsInfo() {
        const channels = Array.from(this.buffers.entries()).map(([keyString, buffer]) => {
            try {
                const channelKey = ChannelKey.fromString(keyString);
                const components = channelKey.getComponents();
                const stats = buffer.getStats();

                return {
                    channel: keyString,
                    ...components,
                    eventCount: stats.currentSize,
                    totalStored: stats.totalProcessed,
                    utilizationPercentage: stats.utilizationPercentage,
                    createdAt: stats.createdAt,
                    isFull: stats.isFull
                };
            } catch (error) {
                // Handle malformed keys gracefully
                return {
                    channel: keyString,
                    error: 'Invalid channel format',
                    eventCount: buffer.getCurrentSize(),
                    totalStored: buffer.count
                };
            }
        });

        return {
            success: true,
            totalChannels: this.buffers.size,
            channels: channels,
            serviceStats: this.getServiceStats()
        };
    }

    /**
     * Clear specific channel buffer
     * @param {Object} metadata - Channel metadata
     * @returns {Object} Result of clear operation
     */
    clearChannel(metadata) {
        try {
            const channelKey = new ChannelKey(metadata);
            const keyString = channelKey.toString();
            
            const buffer = this.buffers.get(keyString);
            
            if (!buffer) {
                return {
                    success: false,
                    error: 'Channel not found'
                };
            }

            buffer.clear();
            console.log(`🧹 Cleared buffer for channel: ${keyString}`);

            return {
                success: true,
                channel: keyString,
                message: 'Channel buffer cleared'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get service-wide statistics
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        const totalBufferedEvents = Array.from(this.buffers.values())
            .reduce((sum, buffer) => sum + buffer.getCurrentSize(), 0);

        return {
            ...this.stats,
            totalChannels: this.buffers.size,
            totalBufferedEvents: totalBufferedEvents,
            averageEventsPerChannel: this.buffers.size > 0 ? 
                Math.round(totalBufferedEvents / this.buffers.size) : 0,
            uptime: this._calculateUptime()
        };
    }

    /**
     * Find channels matching a pattern
     * @param {Object} pattern - Pattern to match (use '*' for wildcard)
     * @returns {Array} Matching channels
     */
    findChannels(pattern) {
        const matchingChannels = [];
        
        for (const [keyString, buffer] of this.buffers.entries()) {
            try {
                const channelKey = ChannelKey.fromString(keyString);
                if (channelKey.matches(pattern)) {
                    matchingChannels.push({
                        channel: keyString,
                        ...channelKey.getComponents(),
                        eventCount: buffer.getCurrentSize(),
                        totalStored: buffer.count
                    });
                }
            } catch (error) {
                // Skip malformed keys
                continue;
            }
        }

        return matchingChannels;
    }

    /**
     * Create new buffer for channel
     * @private
     */
    _createBuffer(keyString) {
        const buffer = new CircularBuffer(this.defaultBufferSize);
        this.buffers.set(keyString, buffer);
        this.stats.channelsCreated++;
        
        console.log(`📦 Created new buffer for channel: ${keyString}`);
        return buffer;
    }

    /**
     * Calculate service uptime
     * @private
     */
    _calculateUptime() {
        const start = new Date(this.stats.startTime);
        const now = new Date();
        return Math.round((now - start) / 1000); // seconds
    }

    /**
     * Health check for the service
     * @returns {Object} Health status
     */
    healthCheck() {
        const stats = this.getServiceStats();
        
        return {
            status: 'healthy',
            service: 'EventBufferService',
            ...stats,
            memoryUsage: this._estimateMemoryUsage()
        };
    }

    /**
     * Estimate memory usage
     * @private
     */
    _estimateMemoryUsage() {
        const avgEventSize = 500; // bytes
        const bufferOverhead = 200; // bytes per buffer
        
        const totalEvents = Array.from(this.buffers.values())
            .reduce((sum, buffer) => sum + buffer.getCurrentSize(), 0);
        
        const estimatedBytes = (totalEvents * avgEventSize) + 
                              (this.buffers.size * bufferOverhead);
        
        return {
            estimatedBytes: estimatedBytes,
            estimatedMB: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100
        };
    }
}

module.exports = EventBufferService; 