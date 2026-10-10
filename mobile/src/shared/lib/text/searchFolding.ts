/**
 * Replacements that make a search ignore Spanish accents, applied in this order to BOTH
 * the searched text (foldSearchText) and the stored columns (SQL replace(), in the
 * transactions repository), so both sides are compared in the same form. Stored data is
 * never changed.
 *
 * - á é í ó ú ü (either case) match their plain vowel: "deposito" finds "Depósito".
 * - ñ stays a letter of its own: "nino" does not find "niño" ("ano" never finds "año"),
 *   but "NIÑO" finds "niño". Only its case is folded, since LIKE folds ASCII case only.
 * - Decomposed text (a letter followed by a combining mark) folds like the composed one.
 * - Everything else is left as is; LIKE keeps ignoring ASCII case.
 */
export const SEARCH_FOLDS: readonly (readonly [from: string, to: string])[] = [
  // Decomposed ñ / Ñ (n + combining tilde), before the tilde could be touched.
  ['ñ', 'ñ'],
  ['Ñ', 'ñ'],
  // Decomposed vowels: drop the combining acute accent and diaeresis.
  ['́', ''],
  ['̈', ''],
  ['á', 'a'],
  ['Á', 'a'],
  ['é', 'e'],
  ['É', 'e'],
  ['í', 'i'],
  ['Í', 'i'],
  ['ó', 'o'],
  ['Ó', 'o'],
  ['ú', 'u'],
  ['Ú', 'u'],
  ['ü', 'u'],
  ['Ü', 'u'],
  ['Ñ', 'ñ'],
];

/** The search form of `text` (see SEARCH_FOLDS). */
export function foldSearchText(text: string): string {
  return SEARCH_FOLDS.reduce(
    (folded, [from, to]) => folded.split(from).join(to),
    text,
  );
}
