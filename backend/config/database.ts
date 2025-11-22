/**
 * Database configuration for Postgres. Adjust credentials in .env
 */
import Env from '@ioc:Adonis/Core/Env'

const databaseConfig = {
  connection: 'pg' as const,

  connections: {
    pg: {
      client: 'pg' as const,
      connection: {
        host: Env.get('PG_HOST', 'localhost'),
        port: Env.get('PG_PORT', '5432'),
        user: Env.get('PG_USER', 'postgres'),
        password: Env.get('PG_PASSWORD', 'postgres'),
        database: Env.get('PG_DB_NAME', 'notascam'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      healthCheck: false,
      debug: false,
    },
  },
}

export default databaseConfig
export const connections = databaseConfig.connections
