import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class TraderStat extends BaseModel {
  public static table = 'trader_stats'

  @column({ isPrimary: true })
  public traderId: number

  @column()
  public pnl30d?: number

  @column()
  public winrate?: number

  @column()
  public subsCount?: number

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
