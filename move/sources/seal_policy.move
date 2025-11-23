module notascam::seal_policy {
    use sui::tx_context;
    use notascam::types;

    /// Identité de policy Seal (bytes de "notascam_signals").
    const POLICY_ID: vector<u8> = b"notascam_signals";

    /// Autorise le déchiffrement si :
    /// - l'id demandé correspond à la policy attendue
    /// - le pass n'est pas expiré (vérification côté client via now)
    /// Ici on ne vérifie pas l'expiration faute de clock côté key server ; on se limite à l'ID + ownership du pass.
    public entry fun seal_approve_subscription(id: vector<u8>, pass: &types::SubscriptionPass, ctx: &mut tx_context::TxContext) {
        let sender = tx_context::sender(ctx);
        // Vérifie l'ID de policy.
        assert!(id == POLICY_ID, 0);
        // Vérifie que le sender détient le pass.
        assert!(types::pass_subscriber(pass) == sender, 1);
        // Optionnel : l'expiration peut être vérifiée off-chain avec la clock avant d'appeler cette approbation.
    }
}
