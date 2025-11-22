import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class CoreSchema extends BaseSchema {
  protected tableNameUsers = 'users'
  protected tableNameTraders = 'traders'
  protected tableNameSubs = 'subscriptions'
  protected tableNameSignals = 'signals'
  protected tableNameSignalEvents = 'signal_events'
  protected tableNameStats = 'trader_stats'

  public async up() {
    this.schema.createTable(this.tableNameUsers, (table) => {
      table.increments('id')
      table.string('wallet_address').notNullable().unique()
      table.string('handle').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
    })

    this.schema.createTable(this.tableNameTraders, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable(this.tableNameUsers)
        .onDelete('CASCADE')
      table.text('bio').nullable()
      table.text('avatar_uri').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
    })

    this.schema.createTable(this.tableNameSubs, (table) => {
      table.increments('id')
      table
        .integer('trader_id')
        .unsigned()
        .references('id')
        .inTable(this.tableNameTraders)
        .onDelete('CASCADE')
      table.string('subscriber_wallet').notNullable()
      table.string('onchain_object_id').notNullable()
      table.string('status').notNullable().defaultTo('ACTIVE')
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.string('tx_digest').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.unique(['trader_id', 'subscriber_wallet', 'onchain_object_id'])
      table.index(['trader_id'])
      table.index(['subscriber_wallet'])
    })

    this.schema.createTable(this.tableNameSignals, (table) => {
      table.increments('id')
      table
        .integer('trader_id')
        .unsigned()
        .references('id')
        .inTable(this.tableNameTraders)
        .onDelete('CASCADE')
      table.text('walrus_uri').notNullable()
      table.string('sui_object_id').notNullable()
      table.string('tx_digest').notNullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('valid_until', { useTz: true }).nullable()
      table.index(['trader_id'])
    })

    this.schema.createTable(this.tableNameSignalEvents, (table) => {
      table.increments('id')
      table
        .integer('signal_id')
        .unsigned()
        .references('id')
        .inTable(this.tableNameSignals)
        .onDelete('CASCADE')
      table.string('event_type').notNullable()
      table.string('tx_digest').notNullable()
      table.timestamp('emitted_at', { useTz: true }).notNullable()
    })

    this.schema.createTable(this.tableNameStats, (table) => {
      table
        .integer('trader_id')
        .unsigned()
        .primary()
        .references('id')
        .inTable(this.tableNameTraders)
        .onDelete('CASCADE')
      table.decimal('pnl_30d', 10, 2).nullable()
      table.decimal('winrate', 5, 2).nullable()
      table.integer('subs_count').nullable()
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableNameStats)
    this.schema.dropTable(this.tableNameSignalEvents)
    this.schema.dropTable(this.tableNameSignals)
    this.schema.dropTable(this.tableNameSubs)
    this.schema.dropTable(this.tableNameTraders)
    this.schema.dropTable(this.tableNameUsers)
  }
}
