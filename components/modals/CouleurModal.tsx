'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Couleur, TypePiece } from '@/lib/types';
import { chargerCouleur, chargerCouleurs } from '@/lib/couleur';
import { getTeintesEssayees, ajouterSelectionSimulateur } from '@/lib/store/teintesEssayees';
import { ecouterSimulateur, useSimulateurDisponible } from '@/lib/embed-parent';
import { derniereTeinte, messageOuvrirSimulateur } from '@/lib/embed-messages';
import { postToParent } from '@/lib/navigation';

interface Collection {
  id: string;
  title: string;
  handle: string;
  image: { url: string } | null;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  finition?: string | null;
  images: { edges: { node: { url: string } }[] };
  variants?: {
    selectedOptions: { name: string; value: string }[];
  }[];
}

/** Origine d'une couleur choisie : la popup, ou le simulateur (dernière teinte appliquée) */
export type OrigineCouleur = 'popup' | 'simulateur';

interface CouleurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (couleur: Couleur, origine: OrigineCouleur) => void;
  title?: string;
  targetFinition?: string; // 'Mate', 'Velours', 'Satin'
  /** Type de la pièce : requis pour proposer le simulateur */
  typePiece?: TypePiece;
  /** Entrées vers le simulateur (murs uniquement) */
  simulateur?: boolean;
}

const nettoyerTitre = (titre: string) => titre.replace(' - Peinture biosourcée murs et plafonds', '');

/**
 * Carte d'une teinte. Sans lien simulateur : rendu historique (bouton unique).
 * Avec : la carte reste cliquable pour choisir, « Voir dans ma pièce » en dessous.
 */
function CarteTeinte({ imageUrl, titre, onChoisir, onVoir }: {
  imageUrl?: string;
  titre: string;
  onChoisir: () => void;
  onVoir?: () => void;
}) {
  const contenu = (
    <>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={titre}
          className="w-full h-24 object-cover rounded-md mb-2"
        />
      )}
      <p className="text-xs font-medium text-gray-900 line-clamp-2">
        {nettoyerTitre(titre)}
      </p>
    </>
  );

  if (!onVoir) {
    return (
      <button
        onClick={onChoisir}
        className="group relative bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-primary-500 hover:shadow-md transition-all"
      >
        {contenu}
      </button>
    );
  }

  return (
    <div className="relative bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-primary-500 hover:shadow-md transition-all flex flex-col">
      <button type="button" onClick={onChoisir} className="text-left">
        {contenu}
      </button>
      <button
        type="button"
        onClick={onVoir}
        className="mt-2 text-left text-xs font-medium text-primary-500 underline underline-offset-2 hover:text-primary-600"
      >
        Voir dans ma pièce
      </button>
    </div>
  );
}

export function CouleurModal({ isOpen, onClose, onSelect, title, targetFinition, typePiece, simulateur = false }: CouleurModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teintes essayées dans le simulateur (bloc en tête, murs et plafond)
  const [teintesEssayees, setTeintesEssayees] = useState<Couleur[]>([]);
  const [chargementEssayees, setChargementEssayees] = useState(false);
  // Dernière teinte du simulateur inconnue de la boutique : le bloc est mis en avant
  const [essayeesEnAvant, setEssayeesEnAvant] = useState(false);
  const [attenteSimulateur, setAttenteSimulateur] = useState(false);

  const simulateurDisponible = useSimulateurDisponible();
  const pieceSimulateur = simulateur && simulateurDisponible && typePiece ? typePiece : null;

  // Dernières props, pour les retours asynchrones du simulateur
  const propsRef = useRef({ onSelect, onClose, targetFinition });
  propsRef.current = { onSelect, onClose, targetFinition };

  const chargerTeintesEssayees = useCallback(async () => {
    const handles = getTeintesEssayees();
    if (handles.length === 0) {
      setTeintesEssayees([]);
      return;
    }
    setChargementEssayees(true);
    try {
      setTeintesEssayees(await chargerCouleurs(handles, { targetFinition: propsRef.current.targetFinition }));
    } finally {
      setChargementEssayees(false);
    }
  }, []);

  // Reset l'état et charger les collections à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      // Reset à chaque ouverture - toujours revenir aux collections
      setSelectedCollection(null);
      setProducts([]);
      setError(null);
      setEssayeesEnAvant(false);
      setAttenteSimulateur(false);
      loadCollections();
      chargerTeintesEssayees();
    }
  }, [isOpen, chargerTeintesEssayees]);

  // Retours du simulateur (ouvert en surimpression par la page Shopify).
  // Aucune navigation : la saisie de la page en dessous est conservée.
  useEffect(() => {
    if (!isOpen) return;
    return ecouterSimulateur((evenement) => {
      setAttenteSimulateur(false);
      if (evenement.type === 'colibri:simulateur:ferme' || evenement.teintes.length === 0) return;

      // Toutes rejoignent « Vos teintes essayées » (la plus récente en tête)
      ajouterSelectionSimulateur(evenement.teintes);
      setError(null);

      // La dernière appliquée (la plus récente) est posée sur le mur ciblé,
      // quel que soit le nombre de teintes
      const derniere = derniereTeinte(evenement.teintes);
      if (!derniere) return;
      const proposerAuChoix = () => {
        setSelectedCollection(null);
        setProducts([]);
        setEssayeesEnAvant(true);
        chargerTeintesEssayees();
      };
      const { targetFinition: finition } = propsRef.current;
      chargerCouleur(derniere, { targetFinition: finition })
        .then((couleur) => {
          if (couleur) {
            propsRef.current.onSelect(couleur, 'simulateur');
            propsRef.current.onClose();
          } else {
            // Teinte inconnue de la boutique : le client choisit parmi les autres
            proposerAuChoix();
          }
        })
        .catch((err: unknown) => {
          console.error(err);
          setError('Impossible de sélectionner cette couleur');
          proposerAuChoix();
        });
    });
  }, [isOpen, chargerTeintesEssayees]);

  const ouvrirSimulateur = (teinte?: string) => {
    if (!pieceSimulateur) return;
    setError(null);
    setAttenteSimulateur(true);
    postToParent(messageOuvrirSimulateur(pieceSimulateur, teinte));
  };

  const loadCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/shopify/collections');
      if (!response.ok) throw new Error('Erreur lors du chargement des collections');
      const data = await response.json();
      
      // Filtrer les collections de couleurs (Les Blancs, Les Bleus, etc.)
      const colorCollections = data.collections.filter((c: Collection) => 
        c.title.startsWith('Les ') || c.title === 'Schmidt X Colibri'
      );
      setCollections(colorCollections);
    } catch (err) {
      setError('Impossible de charger les collections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (collectionHandle: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shopify/collections/${collectionHandle}`);
      if (!response.ok) throw new Error('Erreur lors du chargement des produits');
      const data = await response.json();
      
      let allProducts = data.products;
      let filtered = allProducts;

      if (targetFinition) {
        // Normalisation de la finition (ex: 'Mate' -> 'mat')
        const target = targetFinition.toLowerCase() === 'mate' ? 'mat' : targetFinition.toLowerCase();
        
        filtered = allProducts.filter((p: any) => {
          // Utiliser le nouveau champ 'finitions' (tableau) renvoyé par l'API
          if (p.finitions && p.finitions.length > 0) {
            return p.finitions.some((f: string) => f.toLowerCase().includes(target));
          }
          
          // Fallback de sécurité sur le titre si 'finitions' est absent
          return p.title.toLowerCase().includes(target);
        });

        // Fallback : si le filtrage est trop strict (0 résultats), on garde tout
        if (filtered.length === 0) {
          console.warn(`Aucun produit trouvé pour la finition ${target}, affichage de tous les produits.`);
          filtered = allProducts;
        }
      }
      
      setProducts(filtered);
    } catch (err) {
      setError('Impossible de charger les produits');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollection = (collectionHandle: string) => {
    setSelectedCollection(collectionHandle);
    loadProducts(collectionHandle);
  };

  const handleSelectProduct = async (product: Product) => {
    // Récupérer les détails complets du produit (avec metafields)
    try {
      const couleur = await chargerCouleur(product.handle, {
        targetFinition,
        collection: collections.find(c => c.handle === selectedCollection)?.title || '',
        produit: {
          id: product.id,
          handle: product.handle,
          title: product.title,
          imageUrl: product.images.edges[0]?.node.url || '',
        },
      });
      if (!couleur) throw new Error('Erreur lors du chargement du produit');

      onSelect(couleur, 'popup');
      onClose();
    } catch (err) {
      setError('Impossible de sélectionner cette couleur');
      console.error(err);
    }
  };

  const handleSelectTeinteEssayee = (couleur: Couleur) => {
    onSelect(couleur, 'popup');
    onClose();
  };

  const handleClose = () => {
    // Reset l'état à la fermeture aussi
    setSelectedCollection(null);
    setProducts([]);
    setAttenteSimulateur(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-900">
                {title || 'Choisir une couleur'}
              </h2>
              {targetFinition && (
                <p className="text-xs text-primary-600 font-medium">
                  Finition recommandée : <span className="font-bold uppercase">{targetFinition}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {attenteSimulateur && (
              <div className="flex flex-col items-center text-center gap-4 py-12" role="status">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <div>
                  <p className="font-medium text-gray-900">Le simulateur est ouvert</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Appliquez vos teintes sur les murs de la photo, puis cliquez sur «&nbsp;Utiliser&nbsp;»&nbsp;: la dernière teinte appliquée sera posée sur ce mur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttenteSimulateur(false)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
                >
                  Revenir au choix des couleurs
                </button>
              </div>
            )}

            {!attenteSimulateur && loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            )}

            {!attenteSimulateur && !loading && !selectedCollection && (
              <div>
                {(teintesEssayees.length > 0 || chargementEssayees) && (
                  <section
                    className={`mb-6 rounded-lg ${essayeesEnAvant ? 'border-2 border-primary-500 bg-primary-50 p-4' : ''}`}
                  >
                    <h3 className="text-lg font-medium text-gray-900">Vos teintes essayées</h3>
                    {essayeesEnAvant && (
                      <p className="text-sm text-primary-600 mt-1">
                        Voici les teintes retenues dans le simulateur&nbsp;: choisissez celle de ce mur.
                      </p>
                    )}
                    {chargementEssayees && teintesEssayees.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                        {teintesEssayees.map((couleur) => (
                          <CarteTeinte
                            key={couleur.productHandle}
                            imageUrl={couleur.imageUrl}
                            titre={couleur.titre}
                            onChoisir={() => handleSelectTeinteEssayee(couleur)}
                            onVoir={pieceSimulateur ? () => ouvrirSimulateur(couleur.productHandle) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {pieceSimulateur && (
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
                    <p className="flex-1 text-sm text-primary-600">
                      <span className="font-semibold">Vous hésitez&nbsp;?</span> Essayez les teintes sur une photo de votre pièce.
                    </p>
                    <button
                      type="button"
                      onClick={() => ouvrirSimulateur()}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
                    >
                      Essayer dans ma pièce
                    </button>
                  </div>
                )}

                <h3 className="text-lg font-medium text-gray-900 mb-4">Collections</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleSelectCollection(collection.handle)}
                      className="group relative bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors text-left"
                    >
                      {collection.image && (
                        <img
                          src={collection.image.url}
                          alt={collection.title}
                          className="w-full h-32 object-cover rounded-md mb-2"
                        />
                      )}
                      <p className="font-medium text-gray-900 group-hover:text-primary-600">
                        {collection.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!attenteSimulateur && !loading && selectedCollection && (
              <div>
                <button
                  onClick={() => {
                    setSelectedCollection(null);
                    setProducts([]);
                  }}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Retour aux collections
                </button>

                <h3 className="text-lg font-medium text-gray-900 mb-4">Couleurs disponibles</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <CarteTeinte
                      key={product.id}
                      imageUrl={product.images.edges[0]?.node.url}
                      titre={product.title}
                      onChoisir={() => handleSelectProduct(product)}
                      onVoir={pieceSimulateur ? () => ouvrirSimulateur(product.handle) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
