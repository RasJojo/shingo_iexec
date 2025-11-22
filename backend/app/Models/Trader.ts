import { DateTime } from 'luxon'
import { BaseModel, belongsTo, BelongsTo, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import User from './User'
import Subscription from './Subscription'
import Signal from './Signal'
import TraderStat from './TraderStat'

export default class Trader extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public userId: number

  @column()
  public bio?: string

  @column()
  public avatarUri?: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>

  @hasMany(() => Subscription)
  public subscriptions: HasMany<typeof Subscription>

  @hasMany(() => Signal)
  public signals: HasMany<typeof Signal>

  @belongsTo(() => TraderStat, { foreignKey: 'id' })
  public stats: BelongsTo<typeof TraderStat>
}
