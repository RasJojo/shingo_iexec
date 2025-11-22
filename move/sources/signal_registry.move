module notascam::signal_registry {
    use std::vector;
    use sui::clock;
    use sui::object;
    use sui::transfer;
    use sui::tx_context::TxContext;

    use notascam::errors;
    use notascam::types;
    use notascam::views;

    /// Publie un signal en stockant uniquement une référence (URI Walrus chiffré).
    /// Seul le trader détenteur de la TraderCap peut publier.
    public entry fun publish_signal(trader_cap: &types::TraderCap, walrus_uri: vector<u8>, valid_until: u64, clk: &clock::Clock, ctx: &mut TxContext) {
        let now = clock::now_ms(clk);
        assert!(views::uri_is_valid(&walrus_uri), errors::E_EMPTY_URI);
        assert!(views::is_valid_expiry(valid_until, now), errors::E_INVALID_EXPIRY);

        let signal = types::SignalRef {
            id: object::new(ctx),
            trader: trader_cap.trader,
            walrus_uri,
            valid_until,
        };
        types::emit_signal_published(trader_cap.trader, &signal);
        transfer::transfer(signal, trader_cap.trader);
    }
}
