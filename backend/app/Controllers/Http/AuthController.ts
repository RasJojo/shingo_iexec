import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'
import Env from '@ioc:Adonis/Core/Env'
import jwt from 'jsonwebtoken'

export default class AuthController {
  /**
   * Vérifie une signature (Slush/Sui perso) et retourne un token de session.
   * Ici on ne valide pas réellement la signature faute d’API Slush intégrée.
   * À implémenter avec le SDK Slush ou la vérification `verifyPersonalMessage`.
   */
  public async verify({ request, response }: HttpContextContract) {
    const wallet = request.input('wallet_address')
    // TODO: vérifier la signature/nonce avec Slush ou Sui SDK
    if (!wallet) {
      return response.badRequest({ error: 'wallet_address requis' })
    }

    const user = await User.firstOrCreate(
      { walletAddress: wallet },
      { walletAddress: wallet, handle: wallet.slice(0, 6) }
    )

    const token = jwt.sign({ uid: user.id, wallet }, Env.get('JWT_SECRET'), { expiresIn: '1d' })
    return { token, user }
  }
}
