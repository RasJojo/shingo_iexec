import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'
import Env from '@ioc:Adonis/Core/Env'
import jwt from 'jsonwebtoken'
import { verifyPersonalMessage } from '@mysten/sui.js/verify'

export default class AuthController {
  /**
   * Vérifie une signature (Slush/Sui perso) et retourne un token de session.
   */
  public async verify({ request, response }: HttpContextContract) {
    const wallet = request.input('wallet_address')
    const signature = request.input('signature')
    const messageB64 = request.input('message')

    if (!wallet || !signature || !messageB64) {
      return response.badRequest({ error: 'wallet_address, signature, message requis' })
    }

    const messageBytes = Buffer.from(messageB64, 'base64')
    try {
      await verifyPersonalMessage(Uint8Array.from(messageBytes), signature)
    } catch {
      return response.unauthorized({ error: 'Signature invalide' })
    }

    const user = await User.firstOrCreate(
      { walletAddress: wallet },
      { walletAddress: wallet, handle: wallet.slice(0, 6) }
    )

    const token = jwt.sign({ uid: user.id, wallet }, Env.get('JWT_SECRET'), { expiresIn: '1d' })
    return { token, user }
  }
}
