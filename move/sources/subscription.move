module notascam::subscription {
    use sui::clock;
    use sui::tx_context::{self, TxContext};
    use sui::object;
    use sui::transfer;

    use notascam::errors;
    use notascam::types;

    /// Initialise le système en frappant une AdminCap pour le déployeur.
    /// À appeler une seule fois après publish.
    public entry fun init(ctx: &mut TxContext) {
        let admin = types::AdminCap { id: object::new(ctx) };
        transfer::transfer(admin, tx_context::sender(ctx));
    }

    /// Enregistre un trader et lui attribue une TraderCap.
    public entry fun register_trader(_admin: &types::AdminCap, trader: address, ctx: &mut TxContext) {
        let cap = types::TraderCap { id: object::new(ctx), trader };
        types::emit_trader_registered(trader, &cap);
        transfer::transfer(cap, trader);
    }

    /// Frappe un abonnement pour un trader et le transfère au subscriber.
    public entry fun mint_subscription(trader_cap: &types::TraderCap, subscriber: address, expires_at: u64, clk: &clock::Clock, ctx: &mut TxContext) {
        let now = clock::now_ms(clk);
        assert!(views::is_valid_expiry(expires_at, now), errors::E_INVALID_EXPIRY);

        let pass = types::SubscriptionPass {
            id: object::new(ctx),
            trader: trader_cap.trader,
            subscriber,
            expires_at,
        };
        types::emit_subscription_minted(trader_cap.trader, subscriber, &pass);
        transfer::transfer(pass, subscriber);
    }

    /// Révoque/détruit un pass (doit être appelé par le détenteur du pass ou avec son accord).
    public entry fun revoke(trader_cap: &types::TraderCap, pass: types::SubscriptionPass) {
        assert!(trader_cap.trader == pass.trader, errors::E_TRADER_MISMATCH);
        types::emit_subscription_revoked(pass.trader, pass.subscriber, &pass);
        object::delete(pass);
    }
}
