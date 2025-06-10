import { CareRelayServer } from './server.js';

/**
 * Punto de entrada de la aplicación Care Relay
 */
async function main() {
  try {
    console.log('🔄 Iniciando Care Relay...');
    
    // Creamos e iniciamos el servidor
    const server = new CareRelayServer();
    server.start();

    // Manejo elegante de señales de terminación
    process.on('SIGINT', async () => {
      console.log('\n🔄 Recibida señal SIGINT. Cerrando servidor...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🔄 Recibida señal SIGTERM. Cerrando servidor...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
}

// Iniciamos la aplicación
main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
}); 