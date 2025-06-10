// src/server.ts

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { PipelineHandler } from './modules/pipeline/pipeline.handler.js';
import { ClientHandler } from './modules/client/client.handler.js';

/**
 * Clase principal del servidor Care Relay
 */
export class CareRelayServer {
  private app: express.Application;
  private httpServer: http.Server;
  private io: Server;
  private pipelineHandler: PipelineHandler;
  private clientHandler: ClientHandler;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.io = new Server(this.httpServer, {
      cors: config.cors
    });

    // Inicializamos los handlers
    this.pipelineHandler = new PipelineHandler(this.io);
    this.clientHandler = new ClientHandler(this.io);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  /**
   * Configura el middleware de Express
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Configura las rutas HTTP
   */
  private setupRoutes(): void {
    // Ruta de salud del servidor
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Care Relay',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connectedClients: this.clientHandler.getConnectedClientsCount()
      });
    });

    // Ruta de estadísticas
    this.app.get('/stats', (req, res) => {
      res.json({
        connectedClients: this.clientHandler.getConnectedClientsCount(),
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
      });
    });

    // Ruta para health checks
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  }

  /**
   * Configura los manejadores de Socket.IO
   */
  private setupSocketHandlers(): void {
    // Inicializamos los handlers
    this.pipelineHandler.initialize();
    this.clientHandler.initialize();

    // Log de conexiones globales
    this.io.on('connection', (socket) => {
      console.log(`[RELAY] Nueva conexión: ${socket.id}`);
      
      socket.on('disconnect', (reason) => {
        console.log(`[RELAY] Desconexión: ${socket.id} - Razón: ${reason}`);
      });
    });
  }

  /**
   * Inicia el servidor
   */
  public start(): void {
    this.httpServer.listen(config.port, () => {
      console.log(`🚀 Servidor escuchando en http://localhost:${config.port}`);
      console.log(`✅ Relay esperando conexiones...`);
    });
  }

  /**
   * Detiene el servidor de forma elegante
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('🛑 Servidor detenido correctamente');
        resolve();
      });
    });
  }
} 