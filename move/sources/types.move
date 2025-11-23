module notascam::types {
    use sui::event;
    use sui::object;
    use sui::transfer;
    use sui::tx_context::TxContext;

    /// Cap détenu par l'admin pour autoriser les enregistrements de traders.
    public struct AdminCap has key {
        id: object::UID,
    }

    /// Cap détenu par un trader pour publier et gérer ses objets.
    /// Contient un prix d'abonnement (en Mist) fixé par le trader.
    public struct TraderCap has key {
        id: object::UID,
        trader: address,
        price_mist: u64,
    }

    /// Profil partagé utilisé pour la souscription sans possession du TraderCap.
    public struct TraderProfile has key {
        id: object::UID,
        trader: address,
        price_mist: u64,
    }

    /// Droit d'accès à un trader (peut représenter un abonnement).
    public struct SubscriptionPass has key {
        id: object::UID,
        trader: address,
        subscriber: address,
        expires_at: u64,
    }

    /// Référence on-chain d'un signal publié (URI Walrus chiffré).
    public struct SignalRef has key {
        id: object::UID,
        trader: address,
        walrus_uri: vector<u8>,
        valid_until: u64,
    }

    /// Events pour l'audit.
    public struct TraderRegistered has copy, drop {
        trader: address,
        cap_id: object::ID,
    }

    /// Event pour les profils partagés (souscription publique).
    public struct TraderProfileCreated has copy, drop {
        trader: address,
        profile_id: object::ID,
    }

    public struct SubscriptionMinted has copy, drop {
        trader: address,
        subscriber: address,
        pass_id: object::ID,
        expires_at: u64,
    }

    public struct SubscriptionRevoked has copy, drop {
        trader: address,
        subscriber: address,
        pass_id: object::ID,
    }

    public struct SignalPublished has copy, drop {
        trader: address,
        signal_id: object::ID,
        valid_until: u64,
    }

    /* Factories (object construction confined to this module) */
    public fun new_admin_cap(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }

    public fun new_trader_cap(trader: address, price_mist: u64, ctx: &mut TxContext): TraderCap {
        TraderCap { id: object::new(ctx), trader, price_mist }
    }

    public fun new_trader_profile(trader: address, price_mist: u64, ctx: &mut TxContext): TraderProfile {
        TraderProfile { id: object::new(ctx), trader, price_mist }
    }

    public fun new_subscription_pass(trader: address, subscriber: address, expires_at: u64, ctx: &mut TxContext): SubscriptionPass {
        SubscriptionPass { id: object::new(ctx), trader, subscriber, expires_at }
    }

    public fun new_signal_ref(trader: address, walrus_uri: vector<u8>, valid_until: u64, ctx: &mut TxContext): SignalRef {
        SignalRef { id: object::new(ctx), trader, walrus_uri, valid_until }
    }

    /* Getters */
    public fun trader_addr(cap: &TraderCap): address { cap.trader }
    public fun trader_price(cap: &TraderCap): u64 { cap.price_mist }
    public fun set_price(cap: &mut TraderCap, new_price: u64) {
        cap.price_mist = new_price;
    }
    public fun profile_trader(p: &TraderProfile): address { p.trader }
    public fun profile_price(p: &TraderProfile): u64 { p.price_mist }
    public fun pass_trader(pass: &SubscriptionPass): address { pass.trader }
    public fun pass_subscriber(pass: &SubscriptionPass): address { pass.subscriber }
    public fun pass_expires_at(pass: &SubscriptionPass): u64 { pass.expires_at }
    public fun signal_trader(sig: &SignalRef): address { sig.trader }
    public fun signal_valid_until(sig: &SignalRef): u64 { sig.valid_until }
    /* Transfer helpers (transfer restricted to defining module) */
    public fun transfer_admin(admin: AdminCap, to: address) {
        transfer::transfer(admin, to)
    }
    public fun transfer_trader_cap(cap: TraderCap, to: address) {
        transfer::transfer(cap, to)
    }
    /// Les profils sont partagés (pas transférés).
    public fun share_trader_profile(profile: TraderProfile) {
        transfer::share_object(profile)
    }
    public fun transfer_pass(pass: SubscriptionPass, to: address) {
        transfer::transfer(pass, to)
    }
    public fun transfer_signal(signal: SignalRef, _to: address) {
        // Partage en objet partagé pour permettre l'accès (seal_approve) sans ownership direct
        transfer::share_object(signal)
    }

    public fun delete_pass(pass: SubscriptionPass) {
        let SubscriptionPass { id, trader: _, subscriber: _, expires_at: _ } = pass;
        object::delete(id);
    }

    /* Events */
    public fun emit_trader_registered(trader: address, cap: &TraderCap) {
        let cap_id = object::id(cap);
        event::emit(TraderRegistered { trader, cap_id });
    }

    public fun emit_trader_profile_created(trader: address, profile: &TraderProfile) {
        let profile_id = object::id(profile);
        event::emit(TraderProfileCreated { trader, profile_id });
    }

    public fun emit_subscription_minted(trader: address, subscriber: address, pass: &SubscriptionPass) {
        let pass_id = object::id(pass);
        event::emit(SubscriptionMinted { trader, subscriber, pass_id, expires_at: pass.expires_at });
    }

    public fun emit_subscription_revoked(trader: address, subscriber: address, pass: &SubscriptionPass) {
        let pass_id = object::id(pass);
        event::emit(SubscriptionRevoked { trader, subscriber, pass_id });
    }

    public fun emit_signal_published(trader: address, signal: &SignalRef) {
        let signal_id = object::id(signal);
        event::emit(SignalPublished { trader, signal_id, valid_until: signal.valid_until });
    }
}
