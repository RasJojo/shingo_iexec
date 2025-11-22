module notascam::views {
    use std::vector;
    use notascam::types;

    /// Expiration simple : l'appelant fournit un timestamp courant (ms).
    public fun is_active(pass: &types::SubscriptionPass, now: u64): bool {
        now < types::pass_expires_at(pass)
    }

    /// Valide une expiration (plus tard que `now`).
    public fun is_valid_expiry(expires_at: u64, now: u64): bool {
        expires_at > now
    }

    /// Vérifie qu'une URI Walrus n'est pas vide.
    public fun uri_is_valid(uri: &vector<u8>): bool {
        !vector::is_empty(uri)
    }
}
