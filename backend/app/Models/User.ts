import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Trader from './Trader'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public walletAddress: string

  @column()
  public handle?: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @hasMany(() => Trader)
  public traders: HasMany<typeof Trader>
}
