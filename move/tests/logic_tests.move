#[test_only]
module notascam::tests::logic_tests {
    use std::debug;
    use std::vector;

    use notascam::views;

    #[test]
    fun uri_validation() {
        let empty = vector::empty<u8>();
        debug::assert!(!views::uri_is_valid(&empty), 0);

        let mut uri = vector::empty<u8>();
        vector::push_back(&mut uri, 1);
        debug::assert!(views::uri_is_valid(&uri), 1);
    }

    #[test]
    fun expiry_validation() {
        let now = 100;
        let later = 200;
        debug::assert!(views::is_valid_expiry(later, now), 0);
        debug::assert!(!views::is_valid_expiry(now, now), 1);
    }
}
