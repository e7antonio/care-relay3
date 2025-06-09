import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';

// Servicios principales
import { CommunicationService } from './core/communication/communicationService';
import { AlertaCareService } from './core/alertacare/alertaCareService';
import { ManagementService } from './core/management/managementService';

// Controladores WebSocket por contexto
import { CommunicationWebSocketController } from './infrastructure/websocket/communicationWebSocketController';
import { AlertaCareWebSocketController } from './infrastructure/websocket/alertaCareWebSocketController';
import { ManagementWebSocketController } from './infrastructure/websocket/managementWebSocketController';

// Controladores API por contexto
import { CommunicationApiController } from './infrastructure/api/communicationApiController';
import { AlertaCareApiController } from './infrastructure/api/alertaCareApiController';
import { ManagementApiController } from './infrastructure/api/managementApiController';

class CareRelayServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;

    // Servicios principales
    private communicationService: CommunicationService;
    private alertaCareService: AlertaCareService;
    private managementService: ManagementService;

    // Controladores WebSocket por contexto
    private communicationWebSocketController: CommunicationWebSocketController;
    private alertaCareWebSocketController: AlertaCareWebSocketController;
    private managementWebSocketController: ManagementWebSocketController;

    // Controladores API por contexto
    private communicationApiController: CommunicationApiController;
    private alertaCareApiController: AlertaCareApiController;
    private managementApiController: ManagementApiController;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Configurar Socket.IO
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Inicializar servicios
        this.communicationService = new CommunicationService();
        this.alertaCareService = new AlertaCareService();
        this.managementService = new ManagementService(
            this.communicationService,
            this.alertaCareService
        );

        // Inicializar controladores WebSocket
        this.communicationWebSocketController = new CommunicationWebSocketController(
            this.io,
            this.communicationService
        );
        this.alertaCareWebSocketController = new AlertaCareWebSocketController(
            this.alertaCareService
        );
        this.managementWebSocketController = new ManagementWebSocketController(
            this.managementService
        );

        // Inicializar controladores API
        this.communicationApiController = new CommunicationApiController(
            this.communicationService
        );
        this.alertaCareApiController = new AlertaCareApiController(
            this.alertaCareService
        );
        this.managementApiController = new ManagementApiController(
            this.managementService
        );

        this.setupExpress();
        this.setupWebSocket();
        this.setupGracefulShutdown();
    }

    private setupExpress(): void {
        // Servir archivos estáticos
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Middleware para parsing JSON
        this.app.use(express.json());
        
        // Configurar rutas de API por contexto
        this.app.use('/api/communication', this.communicationApiController.getRouter());
        this.app.use('/api/alertacare', this.alertaCareApiController.getRouter());
        this.app.use('/api/management', this.managementApiController.getRouter());
        
        // Ruta por defecto para SPA
        this.app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.sendFile(path.join(__dirname, '../public/index.html'));
            }
        });
    }

    private setupWebSocket(): void {
        // Configurar middleware de WebSocket
        this.io.use((socket, next) => {
            console.log(`Nueva conexión: ${socket.id} desde ${socket.handshake.address}`);
            next();
        });
        
        // Manejar conexiones
        this.io.on('connection', (socket) => {
            // Registrar nueva conexión
            this.communicationService.addConnection(socket.id);
            this.managementService.onConnectionAdded();

            console.log(`Cliente conectado: ${socket.id}`);

            // Enviar información de conexión
            socket.emit('connection_info', {
                id: socket.id,
                totalConnections: this.communicationService.getConnectionsCount(),
                timestamp: new Date()
            });

            // Notificar nueva conexión
            socket.broadcast.emit('user_connected', {
                userId: socket.id,
                totalConnections: this.communicationService.getConnectionsCount()
            });

            // Configurar handlers por contexto
            this.communicationWebSocketController.handleConnection(socket);
            this.alertaCareWebSocketController.handleConnection(socket);
            this.managementWebSocketController.handleConnection(socket);

            // Manejar desconexión
            socket.on('disconnect', (reason: string) => {
                // Llamar a los handlers de desconexión por contexto
                this.communicationWebSocketController.handleDisconnection(socket, reason);
                this.alertaCareWebSocketController.handleDisconnection(socket, reason);
                this.managementWebSocketController.handleDisconnection(socket, reason);

                // Limpiar conexión del servicio de comunicación
                this.communicationService.removeConnection(socket.id);

                // Notificar desconexión
                socket.broadcast.emit('user_disconnected', {
                    userId: socket.id,
                    totalConnections: this.communicationService.getConnectionsCount(),
                    reason: reason
                });
            });
        });
    }

    private setupGracefulShutdown(): void {
        const shutdown = () => {
            console.log('Shutting down gracefully...');
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }

    public start(port: number = 3000): void {
        this.server.listen(port, () => {
            console.log(`🚀 Care Relay Server running on port ${port}`);
            console.log(`📡 WebSocket ready for connections`);
            
            console.log(`\n📋 API Endpoints by Context:`);
            console.log(`   💬 Communication: http://localhost:${port}/api/communication/*`);
            console.log(`   🚨 Alerta Care: http://localhost:${port}/api/alertacare/*`);
            console.log(`   ⚙️  Management: http://localhost:${port}/api/management/*`);
            
            console.log(`\n🔗 Quick Links:`);
            console.log(`   📊 Server Stats: http://localhost:${port}/api/management/stats`);
            console.log(`   🏥 Health Check: http://localhost:${port}/api/management/health`);
            console.log(`   📈 Metrics: http://localhost:${port}/api/management/metrics`);
            console.log(`   💬 Connections: http://localhost:${port}/api/communication/connections`);
            console.log(`   🚨 AlertaCare Stats: http://localhost:${port}/api/alertacare/stats`);
            
            console.log(`\n📋 Available Contexts:`);
            console.log(`   💬 Communication: rooms, private messages, broadcast`);
            console.log(`   🚨 Alerta Care: inference.tap, tracker.tap channels`);
            console.log(`   ⚙️  Management: stats, health, logs, metrics`);
        });
    }

    // Métodos para acceder a los servicios (útil para testing)
    public getCommunicationService(): CommunicationService {
        return this.communicationService;
    }

    public getAlertaCareService(): AlertaCareService {
        return this.alertaCareService;
    }

    public getManagementService(): ManagementService {
        return this.managementService;
    }
}

// Inicializar y arrancar el servidor
const server = new CareRelayServer();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.start(PORT); 