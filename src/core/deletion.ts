/**
 * Suppression sécurisée : un produit n'est supprimé que s'il n'est plus référencé
 * par aucune annonce restante ni aucun article d'inventaire.
 */
export function shouldDeleteProduct(remaining: { listings: number; inventoryItems: number }): boolean {
  return remaining.listings === 0 && remaining.inventoryItems === 0;
}
