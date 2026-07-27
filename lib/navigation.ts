// L'app vit dans une iframe cross-origin sur colibripeinture.com/pages/configurateur.
// Les sorties du tunnel (checkout, panier boutique) doivent naviguer la page
// parente : le checkout Shopify refuse l'iframe (frame-ancestors) et le cart
// permalink chargerait le site entier imbriqué dans lui-même.
export const PARENT_ORIGIN = 'https://colibripeinture.com';

export function redirectTop(url: string): void {
  try {
    // Autorisé cross-origin quand la navigation résulte d'un clic (user activation).
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // window.top inaccessible → on délègue au parent
  }
  window.parent.postMessage({ type: 'colibri:redirect', url }, PARENT_ORIGIN);
  setTimeout(() => { window.location.href = url; }, 300);
}
