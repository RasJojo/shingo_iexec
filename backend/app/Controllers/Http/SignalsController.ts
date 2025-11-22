import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Signal from 'App/Models/Signal'
import Trader from 'App/Models/Trader'
import { DateTime } from 'luxon'

export default class SignalsController {
  public async index({ request }: HttpContextContract) {
    const traderId = request.input('trader_id')
    const query = Signal.query().orderBy('createdAt', 'desc')
    if (traderId) {
      query.where('traderId', traderId)
    }
    return await query
  }

  /**
   * Crée un signal après que le front a chiffré (Seal), upload (Walrus) et obtenu l’URI.
   * On persiste la référence on-chain (txDigest, objectId) + walrusUri.
   */
  public async store({ request, response }: HttpContextContract) {
    const data = request.only(['trader_id', 'walrus_uri', 'sui_object_id', 'tx_digest', 'valid_until'])
    if (!data.trader_id || !data.walrus_uri || !data.sui_object_id || !data.tx_digest) {
      return response.badRequest({ error: 'Champs requis manquants' })
    }
    const trader = await Trader.find(data.trader_id)
    if (!trader) return response.badRequest({ error: 'Trader inconnu' })

    const signal = await Signal.create({
      traderId: data.trader_id,
      walrusUri: data.walrus_uri,
      suiObjectId: data.sui_object_id,
      txDigest: data.tx_digest,
      validUntil: data.valid_until ? DateTime.fromISO(data.valid_until) : undefined,
    })
    return signal
  }
}
