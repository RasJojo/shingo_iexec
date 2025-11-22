module notascam::errors {
    const E_UNAUTHORIZED: u64 = 0;
    const E_INVALID_EXPIRY: u64 = 1;
    const E_EMPTY_URI: u64 = 2;
    const E_TRADER_MISMATCH: u64 = 3;

    /// Expose error codes via functions (consts are private to the module).
    public fun unauthorized(): u64 { E_UNAUTHORIZED }
    public fun invalid_expiry(): u64 { E_INVALID_EXPIRY }
    public fun empty_uri(): u64 { E_EMPTY_URI }
    public fun trader_mismatch(): u64 { E_TRADER_MISMATCH }
}
