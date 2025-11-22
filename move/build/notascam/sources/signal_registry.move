module notascam::signal_registry {
    use sui::clock;
    use sui::tx_context::TxContext;

    use notascam::errors;
    use notascam::types;
    use notascam::views;

    /// Publie un signal en stockant uniquement une référence (URI Walrus chiffré).
    /// Seul le trader détenteur de la TraderCap peut publier.
    public entry fun publish_signal(trader_cap: &types::TraderCap, walrus_uri: vector<u8>, valid_until: u64, clk: &clock::Clock, ctx: &mut TxContext) {
        let now = clock::timestamp_ms(clk);
        assert!(views::uri_is_valid(&walrus_uri), errors::empty_uri());
        assert!(views::is_valid_expiry(valid_until, now), errors::invalid_expiry());

        let signal = types::new_signal_ref(types::trader_addr(trader_cap), walrus_uri, valid_until, ctx);
        types::emit_signal_published(types::trader_addr(trader_cap), &signal);
        types::transfer_signal(signal, types::trader_addr(trader_cap));
    }
}
