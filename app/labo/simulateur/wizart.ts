/**
 * Types minimaux du Wizart Deployment Kit (global `window.WizartDeploymentKit`),
 * limités à ce qu'utilise le labo. Source : https://docs-deployment-kit.wizart.ai/
 * et le script v1.1.3 publié.
 */

/** Événement reçu par les abonnés de l'EventBus. */
export interface WizartEvent {
  /** Clé de VISUALIZER_EVENTS (ex. « CHECKOUT_OPTIONS_OPEN »), indéfinie si inconnue du script. */
  eventName: string | undefined;
  data: unknown;
}

export interface WizartVisualizerOptions {
  token: string;
  layoutSettings: {
    targetElement: HTMLElement;
    layout?: string;
  };
  integrationSettings?: {
    locale?: string;
  };
  sceneData?: {
    /** vendor_code du produit (pour Colibri : le handle Shopify). */
    openWithProduct?: string;
  };
}

export interface WizartVisualizer {
  readonly isLoaded: boolean;
  /** No-op dans les versions 1.1.x publiées : show() charge l'iframe. */
  load(): Promise<unknown> | undefined;
  show(): Promise<unknown>;
  destroy(): void;
  /** Documenté comme Array<{ vendor_code, quantity }> : la forme réelle est à vérifier. */
  getShoppingCartState(): Promise<unknown>;
}

export interface WizartDeploymentKitApi {
  Visualizer: new (options: WizartVisualizerOptions) => WizartVisualizer;
  EventBus: {
    subscribe(
      callback: (event: WizartEvent) => void,
      eventName?: string | null,
      visualizer?: WizartVisualizer | null,
    ): symbol;
    unsubscribe(subscriptionId: symbol): void;
  };
  VISUALIZER_EVENTS: Readonly<Record<string, string>>;
  LAYOUTS: Readonly<Record<string, string>>;
}

export function getWizartKit(): WizartDeploymentKitApi | undefined {
  return (window as Window & { WizartDeploymentKit?: WizartDeploymentKitApi }).WizartDeploymentKit;
}
