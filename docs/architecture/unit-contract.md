# Foundation unit contract

The Foundation unit primitive is dimension-based and intentionally narrow for the frozen baseline.

- Dimensions are exactly `mass`, `volume`, and `count`.
- Canonical base units are exactly `g`, `mL`, and `ea`.
- The mapping is authoritative and fixed: `g -> mass`, `mL -> volume`, `ea -> count`.
- Canonical casing is authoritative; values such as `G`, `ml`, `ML`, `EA`, `gram`, and `each` are not canonical.
- Purchasing and container units are contextual conversions and are deferred.
- Conversions, cross-dimensional logic, and Quantity semantics are deferred.
- Database representation remains deferred and is not implemented in this checkpoint.
