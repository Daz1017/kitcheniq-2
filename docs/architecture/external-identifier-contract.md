# External Identifier Contract

KitchenIQ entity identifiers and external identifiers are separate concepts. An external identifier must always be paired with an explicit source namespace.

External identifiers are opaque strings. Their exact textual representation is preserved, including leading zeroes, punctuation, and case. Numeric coercion and case normalization are prohibited.

Source namespaces are open string values, not a frozen catalog of external systems. F-15 does not add source registration, source-specific validation, or integration behavior.

An `ExternalIdentifierRef` contains exactly `sourceNamespace` and `externalId`. It does not contain a KitchenIQ target ID, entity type, mapping, or metadata. Mapping persistence and explicit mapping rules are deferred.

F-15 contains no migration or integration implementation. External identifiers are references, not credentials, and must not contain or represent secrets, tokens, or authentication material.
