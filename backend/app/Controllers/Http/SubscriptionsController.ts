import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Subscription from 'App/Models/Subscription'
import Trader from 'App/Models/Trader'
import { DateTime } from 'luxon'

export default class SubscriptionsController {
  public async index({ request }: HttpContextContract) {
    const wallet = request.input('wallet')
    const query = Subscription.query().orderBy('createdAt', 'desc')
    if (wallet) query.where('subscriberWallet', wallet)
    return await query
  }

  public async store({ request, response }: HttpContextContract) {
    const data = request.only(['trader_id', 'subscriber_wallet', 'onchain_object_id', 'expires_at', 'tx_digest'])
    if (!data.trader_id || !data.subscriber_wallet || !data.onchain_object_id) {
      return response.badRequest({ error: 'Champs requis manquants' })
    }
    const trader = await Trader.find(data.trader_id)
    if (!trader) return response.badRequest({ error: 'Trader inconnu' })

    const sub = await Subscription.create({
      traderId: data.trader_id,
      subscriberWallet: data.subscriber_wallet,
      onchainObjectId: data.onchain_object_id,
      status: 'ACTIVE',
      expiresAt: data.expires_at ? DateTime.fromISO(data.expires_at) : undefined,
      txDigest: data.tx_digest,
    })
    return sub
  }
}
