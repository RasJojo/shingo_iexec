import { DateTime } from 'luxon'
import { BaseModel, belongsTo, BelongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Trader from './Trader'

export default class Signal extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public traderId: number

  @column()
  public walrusUri: string

  @column()
  public suiObjectId: string

  @column()
  public txDigest: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime()
  public validUntil?: DateTime

  @belongsTo(() => Trader)
  public trader: BelongsTo<typeof Trader>
}
