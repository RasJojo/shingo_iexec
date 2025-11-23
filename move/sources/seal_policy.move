module notascam::seal_policy {
    use sui::tx_context;
    use sui::clock;
    use notascam::types;

    /// Identité de policy Seal (bytes de "notascam_signals").
    const POLICY_ID: vector<u8> = b"notascam_signals";

    /// Autorise le déchiffrement :
    /// - si le signal est encore actif : pass requis, non expiré, sender = subscriber
    /// - si le signal est expiré : accès public (pas de pass requis)
    public entry fun seal_approve_subscription(
        id: vector<u8>,
        signal: &types::SignalRef,
        pass: &types::SubscriptionPass,
        clk: &clock::Clock,
        ctx: &mut tx_context::TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        // Vérifie l'ID de policy.
        assert!(id == POLICY_ID, 0);

        let now = clock::timestamp_ms(clk);
        let valid_until = types::signal_valid_until(signal);

        if (now < valid_until) {
            // Actif : vérifier pass (trader + subscriber) et expiration du pass
            assert!(types::pass_trader(pass) == types::signal_trader(signal), 1);
            assert!(types::pass_subscriber(pass) == sender, 2);
            assert!(now < types::pass_expires_at(pass), 3);
        } else {
            // Expiré : accès public
        }
    }
}
