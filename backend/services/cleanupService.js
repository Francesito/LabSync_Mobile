// backend/services/cleanupService.js
// Servicio opcional para automatizar la limpieza de mensajes
const cron = require('node-cron');
const { cleanupOldMessages } = require('../controllers/messageController');

class CleanupService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Iniciar el servicio de limpieza automática
   * Se ejecuta todos los días a las 2:00 AM
   */
  start() {
    if (this.isRunning) {
      console.log('[CleanupService] El servicio ya está ejecutándose');
      return;
    }

    // Ejecutar todos los días a las 2:00 AM
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      console.log('[CleanupService] Iniciando limpieza automática de mensajes antiguos...');
      try {
        const deletedCount = await cleanupOldMessages();
        console.log(`[CleanupService] Limpieza completada. Eliminados: ${deletedCount} mensajes`);
      } catch (error) {
        console.error('[CleanupService] Error en limpieza automática:', error);
      }
    });

    this.isRunning = true;
    console.log('[CleanupService] Servicio de limpieza iniciado - Se ejecutará diariamente a las 2:00 AM');
  }

  /**
   * Detener el servicio de limpieza automática
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('[CleanupService] Servicio de limpieza detenido');
  }

  /**
   * Ejecutar limpieza manual
   */
  async runManualCleanup() {
    console.log('[CleanupService] Ejecutando limpieza manual...');
    try {
      const deletedCount = await cleanupOldMessages();
      console.log(`[CleanupService] Limpieza manual completada. Eliminados: ${deletedCount} mensajes`);
      return deletedCount;
    } catch (error) {
      console.error('[CleanupService] Error en limpieza manual:', error);
      throw error;
    }
  }

  /**
   * Obtener el estado del servicio
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextExecution: this.cronJob ? this.cronJob.nextDate() : null,
      scheduledTime: '2:00 AM diariamente'
    };
  }

  /**
   * Configurar un horario personalizado para la limpieza
   * @param {string} cronExpression - Expresión cron para el horario
   */
  setCustomSchedule(cronExpression) {
    if (this.isRunning) {
      this.stop();
    }

    try {
      this.cronJob = cron.schedule(cronExpression, async () => {
        console.log('[CleanupService] Iniciando limpieza automática (horario personalizado)...');
        try {
          const deletedCount = await cleanupOldMessages();
          console.log(`[CleanupService] Limpieza completada. Eliminados: ${deletedCount} mensajes`);
        } catch (error) {
          console.error('[CleanupService] Error en limpieza automática:', error);
        }
      });

      this.isRunning = true;
      console.log(`[CleanupService] Servicio configurado con horario personalizado: ${cronExpression}`);
    } catch (error) {
      console.error('[CleanupService] Error al configurar horario personalizado:', error);
      throw new Error('Expresión cron inválida');
    }
  }
}

// Singleton para el servicio de limpieza
const cleanupService = new CleanupService();

module.exports = cleanupService;