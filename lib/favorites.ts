// Favoriten-Verwaltung mit localStorage

export const FAVORITES_KEY = "kidgo_favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(FAVORITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addFavorite(sourceId: string): void {
  if (typeof window === "undefined") return;
  const favorites = getFavorites();
  if (!favorites.includes(sourceId)) {
    favorites.push(sourceId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }
}

export function removeFavorite(sourceId: string): void {
  if (typeof window === "undefined") return;
  const favorites = getFavorites();
  const updated = favorites.filter((id) => id !== sourceId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
}

export function toggleFavorite(sourceId: string): boolean {
  if (typeof window === "undefined") return false;
  const favorites = getFavorites();
  const isFavorite = favorites.includes(sourceId);

  if (isFavorite) {
    removeFavorite(sourceId);
  } else {
    addFavorite(sourceId);
  }

  return !isFavorite;
}

export function isFavorite(sourceId: string): boolean {
  if (typeof window === "undefined") return false;
  return getFavorites().includes(sourceId);
}
