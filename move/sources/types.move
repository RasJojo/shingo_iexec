module notascam::types {
    use std::vector;
    use sui::event;
    use sui::id::ID;
    use sui::object::{Self, UID};

    /// Cap détenu par l'admin pour autoriser les enregistrements de traders.
    public struct AdminCap has key {
        id: UID,
    }

    /// Cap détenu par un trader pour publier et gérer ses objets.
    public struct TraderCap has key {
        id: UID,
        trader: address,
    }

    /// Droit d'accès à un trader (peut représenter un abonnement).
    public struct SubscriptionPass has key {
        id: UID,
        trader: address,
        subscriber: address,
        expires_at: u64,
    }

    /// Référence on-chain d'un signal publié (URI Walrus chiffré).
    public struct SignalRef has key {
        id: UID,
        trader: address,
        walrus_uri: vector<u8>,
        valid_until: u64,
    }

    /// Events pour l'audit.
    public struct TraderRegistered has copy, drop {
        trader: address,
        cap_id: ID,
    }

    public struct SubscriptionMinted has copy, drop {
        trader: address,
        subscriber: address,
        pass_id: ID,
        expires_at: u64,
    }

    public struct SubscriptionRevoked has copy, drop {
        trader: address,
        subscriber: address,
        pass_id: ID,
    }

    public struct SignalPublished has copy, drop {
        trader: address,
        signal_id: ID,
        walrus_uri: vector<u8>,
        valid_until: u64,
    }

    /// Helpers d'émission d'events (pour éviter la duplication).
    public fun emit_trader_registered(trader: address, cap: &TraderCap) {
        let cap_id = object::id(&cap.id);
        event::emit(TraderRegistered { trader, cap_id });
    }

    public fun emit_subscription_minted(trader: address, subscriber: address, pass: &SubscriptionPass) {
        let pass_id = object::id(&pass.id);
        event::emit(SubscriptionMinted { trader, subscriber, pass_id, expires_at: pass.expires_at });
    }

    public fun emit_subscription_revoked(trader: address, subscriber: address, pass: &SubscriptionPass) {
        let pass_id = object::id(&pass.id);
        event::emit(SubscriptionRevoked { trader, subscriber, pass_id });
    }

    public fun emit_signal_published(trader: address, signal: &SignalRef) {
        let signal_id = object::id(&signal.id);
        let uri_copy = vector::clone(&signal.walrus_uri);
        event::emit(SignalPublished { trader, signal_id, walrus_uri: uri_copy, valid_until: signal.valid_until });
    }
}
