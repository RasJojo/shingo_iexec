import type { ApplicationContract } from '@ioc:Adonis/Core/Application'
import Logger from '@ioc:Adonis/Core/Logger'
import { ensureTeeSyncServiceStarted, stopTeeSyncService } from 'App/Services/TeeSyncService'

export default class AppProvider {
  constructor(protected app: ApplicationContract) {}

  public register() {
    // Register your own bindings
  }

  public async boot() {
    // IoC container is ready
  }

  public async ready() {
    if (this.app.environment !== 'web') {
      return
    }

    try {
      const syncService = await ensureTeeSyncServiceStarted()
      if (syncService) {
        Logger.info('[tee-sync] started')
      } else {
        Logger.info('[tee-sync] disabled')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      Logger.error(`[tee-sync] failed to start: ${message}`)
    }
  }

  public async shutdown() {
    await stopTeeSyncService()
  }
}
