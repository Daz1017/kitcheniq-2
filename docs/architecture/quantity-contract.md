# Quantity Contract

## Canonical Unit Codes

- CanonicalUnitCode (`g`, `mL`, `ea`)
- Dimensions: `mass`, `volume`, `count`

## Quantity Shape

- `value`: decimal string
- `unit`: canonical unit code

## Constraints

- Quantity values must be valid decimal strings.
- Quantities must use canonical unit codes only.
- Quantity dimensions are derived from the canonical unit mapping.
