/** Convert a display label such as "Featured Products" to "featuredProducts". */
export function slugKey(label) {
  const words = String(label || "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

  return words
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join("");
}

export default slugKey;
