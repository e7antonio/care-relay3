import { Server, Socket } from 'socket.io';

/**
 * Manejador de conexiones de clientes (UI, aplicaciones frontend)
 */
export class ClientHandler {
  private connectedClients = new Set<string>();

  constructor(private io: Server) {}

  /**
   * Inicializa los event listeners para clientes
   */
  public initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      // Registramos el cliente
      socket.on('client:register', (clientData: any) => {
        this.handleClientRegistration(socket, clientData);
      });

      // Manejamos peticiones de estado
      socket.on('client:request_status', () => {
        this.handleStatusRequest(socket);
      });

      // Manejamos desconexiones
      socket.on('disconnect', () => {
        this.handleClientDisconnection(socket);
      });

      console.log(`[CLIENT] Nueva conexión de cliente: ${socket.id}`);
    });
  }

  /**
   * Registra un nuevo cliente y le envía información de bienvenida
   */
  private handleClientRegistration(socket: Socket, clientData: any): void {
    this.connectedClients.add(socket.id);
    
    console.log(`[CLIENT] Cliente registrado: ${socket.id}`, clientData);

    // Enviamos confirmación de registro
    socket.emit('client:registration_success', {
      clientId: socket.id,
      timestamp: new Date().toISOString(),
      message: 'Conectado exitosamente al Care Relay'
    });

    // Enviamos estadísticas actuales
    this.sendCurrentStats(socket);
  }

  /**
   * Maneja peticiones de estado del sistema
   */
  private handleStatusRequest(socket: Socket): void {
    const status = {
      connectedClients: this.connectedClients.size,
      serverUptime: process.uptime(),
      timestamp: new Date().toISOString(),
      status: 'healthy'
    };

    socket.emit('client:status_response', status);
    console.log(`[CLIENT] Estado enviado a ${socket.id}`);
  }

  /**
   * Maneja la desconexión de un cliente
   */
  private handleClientDisconnection(socket: Socket): void {
    this.connectedClients.delete(socket.id);
    console.log(`[CLIENT] Cliente desconectado: ${socket.id}`);
    console.log(`[CLIENT] Clientes conectados: ${this.connectedClients.size}`);
  }

  /**
   * Envía estadísticas actuales al cliente
   */
  private sendCurrentStats(socket: Socket): void {
    const stats = {
      connectedClients: this.connectedClients.size,
      serverUptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    socket.emit('client:current_stats', stats);
  }

  /**
   * Obtiene el número de clientes conectados
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
} 