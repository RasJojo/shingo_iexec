import { DateTime } from 'luxon'
import { BaseModel, belongsTo, BelongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Trader from './Trader'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public traderId: number

  @column()
  public subscriberWallet: string

  @column()
  public onchainObjectId: string

  @column()
  public status: string

  @column.dateTime()
  public expiresAt?: DateTime

  @column()
  public txDigest?: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @belongsTo(() => Trader)
  public trader: BelongsTo<typeof Trader>
}
