module notascam::subscription {
    use sui::clock;
    use sui::coin;
    use sui::transfer;
    use sui::sui::SUI;
    use sui::tx_context;

    use notascam::errors;
    use notascam::types;
    use notascam::views;

    /// Initialise le système en frappant une AdminCap pour un destinataire.
    public entry fun bootstrap_admin(recipient: address, ctx: &mut tx_context::TxContext) {
        let admin = types::new_admin_cap(ctx);
        types::transfer_admin(admin, recipient);
    }

    /// Enregistre un trader et lui attribue une TraderCap.
    public entry fun register_trader(_admin: &types::AdminCap, trader: address, ctx: &mut tx_context::TxContext) {
        let cap = types::new_trader_cap(trader, ctx);
        types::emit_trader_registered(trader, &cap);
        types::transfer_trader_cap(cap, trader);
    }

    /// Enregistrement ouvert (sans AdminCap) pour qu’un wallet devienne trader.
    public entry fun register_trader_open(ctx: &mut tx_context::TxContext) {
        let trader = tx_context::sender(ctx);
        let cap = types::new_trader_cap(trader, ctx);
        types::emit_trader_registered(trader, &cap);
        types::transfer_trader_cap(cap, trader);
    }

    /// Frappe un abonnement pour un trader et le transfère au subscriber.
    public entry fun mint_subscription(trader_cap: &types::TraderCap, subscriber: address, expires_at: u64, clk: &clock::Clock, ctx: &mut tx_context::TxContext) {
        let now = clock::timestamp_ms(clk);
        assert!(views::is_valid_expiry(expires_at, now), errors::invalid_expiry());

        let pass = types::new_subscription_pass(types::trader_addr(trader_cap), subscriber, expires_at, ctx);
        types::emit_subscription_minted(types::trader_addr(trader_cap), subscriber, &pass);
        types::transfer_pass(pass, subscriber);
    }

    /// Mint public : le subscriber paye en SUI et reçoit un pass, le trader reçoit le paiement.
    public entry fun mint_subscription_public(
        trader: address,
        subscriber: address,
        expires_at: u64,
        price: u64,
        clk: &clock::Clock,
        payment: coin::Coin<SUI>,
        ctx: &mut tx_context::TxContext,
    ) {
        let now = clock::timestamp_ms(clk);
        assert!(views::is_valid_expiry(expires_at, now), errors::invalid_expiry());

        // Enforce prix minimal
        let mut pay_coin = payment;
        let available = coin::value(&pay_coin);
        assert!(available >= price, errors::unauthorized());
        let pay_to_trader = coin::split(&mut pay_coin, price, ctx);
        transfer::public_transfer(pay_to_trader, trader);
        // Rendre le change (s’il reste) au subscriber.
        transfer::public_transfer(pay_coin, subscriber);

        let pass = types::new_subscription_pass(trader, subscriber, expires_at, ctx);
        types::emit_subscription_minted(trader, subscriber, &pass);
        types::transfer_pass(pass, subscriber);
    }

    /// Révoque/détruit un pass (doit être appelé par le détenteur du pass ou avec son accord).
    public entry fun revoke(trader_cap: &types::TraderCap, pass: types::SubscriptionPass) {
        assert!(types::trader_addr(trader_cap) == types::pass_trader(&pass), errors::trader_mismatch());
        types::emit_subscription_revoked(types::pass_trader(&pass), types::pass_subscriber(&pass), &pass);
        types::delete_pass(pass);
    }
}
