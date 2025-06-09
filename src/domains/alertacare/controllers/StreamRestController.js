/**
 * StreamRestController - AlertaCare REST Controller
 * 
 * Handles HTTP REST endpoints for AlertaCare stream management.
 * Delegates business logic to EventBufferService.
 * 
 * @domain AlertaCare
 * @author AlertaCare Team
 */

class StreamRestController {
    /**
     * Create StreamRestController instance
     * @param {EventBufferService} eventBufferService - Event buffer service
     */
    constructor(eventBufferService) {
        this.eventBufferService = eventBufferService;
    }

    /**
     * Get events from specific channel
     * GET /streams/:habitacion/:posicion/:origen/:canal/events[?latest=N]
     */
    getEvents = (req, res) => {
        try {
            const { habitacion, posicion, origen, canal } = req.params;
            const { latest } = req.query;
            
            const metadata = { habitacion, posicion, origen, canal };
            const options = latest ? { latest: parseInt(latest) } : {};
            
            const result = this.eventBufferService.getEvents(metadata, options);
            
            if (result.success) {
                res.json({
                    success: true,
                    channel: result.channel,
                    eventCount: result.eventCount,
                    eventos: result.events, // Keep Spanish naming for compatibility
                    ...(result.bufferStats && { bufferStats: result.bufferStats })
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Store event in specific channel
     * POST /streams/:habitacion/:posicion/:origen/:canal/events
     */
    storeEvent = (req, res) => {
        try {
            const { habitacion, posicion, origen, canal } = req.params;
            const event = req.body;
            
            const metadata = { habitacion, posicion, origen, canal };
            const result = this.eventBufferService.storeEvent(metadata, event);
            
            if (result.success) {
                res.json({
                    success: true,
                    channel: result.channel,
                    message: 'Event stored successfully',
                    ...(result.bufferStats && { bufferStats: result.bufferStats })
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get all available channels and their stats
     * GET /streams/channels
     */
    getChannels = (req, res) => {
        try {
            const result = this.eventBufferService.getChannelsInfo();
            
            res.json({
                success: result.success,
                totalChannels: result.totalChannels,
                channels: result.channels,
                serviceStats: result.serviceStats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Clear specific channel buffer
     * DELETE /streams/:habitacion/:posicion/:origen/:canal/events
     */
    clearChannel = (req, res) => {
        try {
            const { habitacion, posicion, origen, canal } = req.params;
            const metadata = { habitacion, posicion, origen, canal };
            
            const result = this.eventBufferService.clearChannel(metadata);
            
            if (result.success) {
                res.json({
                    success: true,
                    channel: result.channel,
                    message: result.message
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Find channels matching pattern
     * GET /streams/search?habitacion=X&posicion=*&origen=Y&canal=Z
     */
    searchChannels = (req, res) => {
        try {
            const { habitacion, posicion, origen, canal } = req.query;
            
            // Build search pattern from query parameters
            const pattern = {};
            if (habitacion) pattern.habitacion = habitacion;
            if (posicion) pattern.posicion = posicion;
            if (origen) pattern.origen = origen;
            if (canal) pattern.canal = canal;

            const matchingChannels = this.eventBufferService.findChannels(pattern);
            
            res.json({
                success: true,
                pattern: pattern,
                matchCount: matchingChannels.length,
                channels: matchingChannels
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get AlertaCare service health
     * GET /streams/health
     */
    getHealth = (req, res) => {
        try {
            const health = this.eventBufferService.healthCheck();
            
            res.json({
                status: health.status,
                alertacare: {
                    service: health.service,
                    buffersActive: health.totalChannels,
                    totalEvents: health.totalBufferedEvents,
                    uptime: health.uptime,
                    memoryUsage: health.memoryUsage
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };

    /**
     * Register all routes with Express app
     * @param {Express} app - Express application
     */
    registerRoutes(app) {
        // Main stream endpoints
        app.get('/streams/:habitacion/:posicion/:origen/:canal/events', this.getEvents);
        app.post('/streams/:habitacion/:posicion/:origen/:canal/events', this.storeEvent);
        app.delete('/streams/:habitacion/:posicion/:origen/:canal/events', this.clearChannel);
        
        // Management endpoints
        app.get('/streams/channels', this.getChannels);
        app.get('/streams/search', this.searchChannels);
        app.get('/streams/health', this.getHealth);
    }
}

module.exports = StreamRestController; 