import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Trader from 'App/Models/Trader'
import User from 'App/Models/User'

export default class TradersController {
  public async index() {
    return await Trader.query().preload('stats')
  }

  public async store({ request, response }: HttpContextContract) {
    const wallet = request.input('wallet_address')
    const bio = request.input('bio')
    const avatarUri = request.input('avatar_uri')
    if (!wallet) return response.badRequest({ error: 'wallet_address requis' })

    const user = await User.firstOrCreate({ walletAddress: wallet }, { walletAddress: wallet })
    const trader = await Trader.create({ userId: user.id, bio, avatarUri })
    return trader
  }
}
