'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { Couleur } from '@/lib/types';

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

interface CouleurModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (couleur: Couleur) => void;
  title?: string;
  targetFinition?: string; // 'Mate', 'Velours', 'Satin'
}

export function CouleurModal({ isOpen, onClose, onSelect, title, targetFinition }: CouleurModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset l'état et charger les collections à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      // Reset à chaque ouverture - toujours revenir aux collections
      setSelectedCollection(null);
      setProducts([]);
      setError(null);
      loadCollections();
    }
  }, [isOpen]);

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
        
        filtered = allProducts.filter((p: Product) => {
          // 1. Vérifier prioritairement le metafield 'finition'
          if (p.finition) {
            return p.finition.toLowerCase().includes(target);
          }

          // 2. Fallback sur le titre
          const titleMatch = p.title.toLowerCase().includes(target);
          
          // 3. Fallback sur les variants
          const variantMatch = p.variants?.some(v => 
            v.selectedOptions?.some(opt => 
              opt.name.toLowerCase() === 'finition' && opt.value.toLowerCase().includes(target)
            )
          );
          
          return titleMatch || variantMatch;
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
      const response = await fetch(`/api/shopify/product/${product.handle}`);
      if (!response.ok) throw new Error('Erreur lors du chargement du produit');
      const data = await response.json();
      
      console.log('DEBUG: Réponse API brute', data);

      // Source de vérité unique : l'option "Finition" des variantes Shopify
      let finition = data.finition || undefined;

      console.log('DEBUG: Sélection couleur (Source: Variants)', {
        handle: product.handle,
        finalFinition: finition
      });

      const couleur: Couleur = {
        productId: product.id,
        productHandle: product.handle,
        titre: product.title,
        collection: collections.find(c => c.handle === selectedCollection)?.title || '',
        base: data.base || 'Blanc',
        sousCouche: data.sousCouche || 'blanche',
        codeHex: data.codeHex || '#FFFFFF',
        finition: finition,
        imageUrl: product.images.edges[0]?.node.url || '',
        variants: data.variants || [],
      };
      
      onSelect(couleur);
      onClose();
    } catch (err) {
      setError('Impossible de sélectionner cette couleur');
      console.error(err);
    }
  };

  const handleClose = () => {
    // Reset l'état à la fermeture aussi
    setSelectedCollection(null);
    setProducts([]);
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

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            )}

            {!loading && !selectedCollection && (
              <div>
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

            {!loading && selectedCollection && (
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
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="group relative bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-primary-500 hover:shadow-md transition-all"
                    >
                      {product.images.edges[0] && (
                        <img
                          src={product.images.edges[0].node.url}
                          alt={product.title}
                          className="w-full h-24 object-cover rounded-md mb-2"
                        />
                      )}
                      <p className="text-xs font-medium text-gray-900 line-clamp-2">
                        {product.title.replace(' - Peinture biosourcée murs et plafonds', '')}
                      </p>
                    </button>
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
