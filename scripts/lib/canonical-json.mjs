// Canonical JSON serialization, byte-compatible with Python's
//   json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
//
// Used for both src/architecture/arch-templates.generated.json and the
// TS-derived effective-page fixtures, so the Node side and the Python
// side (scripts/arch_effective_page.py) produce identical bytes.
//
// Guarantees:
//  - object keys sorted recursively (ascending by code unit; all keys in
//    this data set are ASCII, so this matches Python's code-point sort)
//  - 2-space indentation, "\n" newlines, ": " / ",\n" separators
//  - non-ASCII characters emitted raw (UTF-8), never \uXXXX-escaped
//  - exactly one trailing newline
//  - undefined object values are dropped (matches JSON.stringify and the
//    "key omitted" semantics resolvePage() relies on)

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      out[key] = sortValue(value[key]);
    }
    return out;
  }
  return value;
}

export function canonicalize(value) {
  return JSON.stringify(sortValue(value), null, 2) + '\n';
}
