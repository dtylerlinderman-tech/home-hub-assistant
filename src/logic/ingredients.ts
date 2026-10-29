// Match ingredients mentioned in a step's text, for recipes without per-step links.

const SKIP = new Set([
  'ground', 'fresh', 'large', 'small', 'medium', 'chopped', 'sliced', 'diced', 'minced', 'kosher',
  'smoked', 'dried', 'whole', 'boneless', 'skinless', 'thinly', 'finely', 'freshly', 'cracked', 'grated', 'unsalted', 'cup', 'cups', 'tbsp', 'tsp',
  'pound', 'ounce', 'ounces', 'red', 'green', 'yellow', 'white', 'black', 'plain', 'with', 'and', 'for',
]);

function stem(w: string): string {
  return w.replace(/(es|s)$/, '');
}

/**
 * Words that identify an ingredient: from the first comma-separated part that has any.
 * "chicken breast, thinly sliced" → chicken, breast; "boneless, skinless chicken breasts" → chicken, breast.
 */
function keyWords(name: string): string[] {
  for (const part of name.toLowerCase().split(/[,(]/)) {
    const words = part.split(/[^a-z]+/).filter((w) => w.length >= 3 && !SKIP.has(w)).map(stem);
    if (words.length) return words;
  }
  return [];
}

export function matchIngredients<T extends { id: string; name: string }>(stepText: string, ingredients: T[]): string[] {
  const tokens = new Set(stepText.toLowerCase().split(/[^a-z]+/).map(stem));
  return ingredients.filter((ing) => keyWords(ing.name).some((w) => tokens.has(w))).map((ing) => ing.id);
}
