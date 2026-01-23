'use client';

import React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* SECTION 1 : Intro */}
      <div className="logo">
        <img src="/logo-colibri.png" alt="Logo Colibri" />
      </div>

      <section className="hero-section">
        <div className="hero-layout">
          <div className="hero-text">
            <h1>Dans le cadre de votre auto-réparation</h1>
            <p>Suite à votre sinistre, votre assureur vous a proposé de choisir votre peinture directement chez Colibri Peinture.</p>
            <p>Nous avons conçu <b>un parcours clair et guidé</b> pour vous permettre de remettre votre intérieur en état, sans prise de tête.</p>
            <p>Ici, <b>pas de calcul compliqué</b> ni de jargon technique. Vous indiquez vos pièces, vos surfaces, vos couleurs... Nous nous occupons du reste !</p>

            <Link href="/sinistre" className="cta-btn">
              Estimer mon projet
            </Link>
          </div>
          <div className="hero-image"></div>
        </div>
      </section>

      {/* SECTION 2 : Étapes */}
      <section className="steps-section">
        <h2>Comment ça marche ?</h2>
        <p>En <b>seulement 4 étapes</b>, vous recevez tout ce dont vous avez besoin !</p>

        <div className="steps-tabs">
          <input type="radio" name="step" id="step1" defaultChecked />
          <label htmlFor="step1" className="tab-title">1. Pièce à repeindre</label>
          <div className="tab-content">
            <div className="step-number">1</div>
            <h3>Vous nous indiquez la pièce à repeindre</h3>
            <p>Salon, chambre, cuisine, salle de bains... chaque pièce a ses spécificités, nous les connaissons.</p>
          </div>

          <input type="radio" name="step" id="step2" />
          <label htmlFor="step2" className="tab-title">2. Surfaces & couleurs</label>
          <div className="tab-content">
            <div className="step-number">2</div>
            <h3>Vous renseignez vos surfaces et vos couleurs</h3>
            <p>Plafond, murs... vous entrez vos surfaces en m² et vous sélectionnez vos couleurs parmi les 216 teintes.</p>
          </div>

          <input type="radio" name="step" id="step3" />
          <label htmlFor="step3" className="tab-title">3. Calcul automatique</label>
          <div className="tab-content">
            <div className="step-number">3</div>
            <h3>Nous calculons pour vous la juste quantité</h3>
            <p>Afin de limiter le gaspillage, nous calculons pour vous la juste quantité de peinture.</p>
          </div>

          <input type="radio" name="step" id="step4" />
          <label htmlFor="step4" className="tab-title">4. Livraison</label>
          <div className="tab-content">
            <div className="step-number">4</div>
            <h3>Vous recevez votre peinture chez vous</h3>
            <p>La peinture arrive prête à l'emploi, livrée directement à domicile.</p>
          </div>
        </div>
      </section>

      {/* SECTION 3 : Responsable */}
      <section className="responsable-section">
        <input type="radio" name="resp" id="resp1" defaultChecked />
        <input type="radio" name="resp" id="resp2" />
        <input type="radio" name="resp" id="resp3" />
        <input type="radio" name="resp" id="resp4" />

        <div className="resp-tabs-nav">
          <label htmlFor="resp1">Une peinture plus responsable</label>
          <label htmlFor="resp2">Une peinture de qualité</label>
          <label htmlFor="resp3">Un parcours simple</label>
          <label htmlFor="resp4">Des tarifs avantageux</label>
        </div>

        <div className="responsable-layout">
          <div className="responsable-image"></div>
          <div className="responsable-content">
            <div className="resp-panel panel1">
              <h2>Une peinture plus responsable</h2>
              <ul>
                <li>Peinture à base d’ingrédients d’origine naturelle</li>
                <li>Rejette moins de 1g/L de COV</li>
                <li>Peintures colorées à la commande</li>
                <li>Fabriquée en France</li>
                <li>Certification NF Environnement délivrée par l’AFNOR</li>
              </ul>
            </div>
            <div className="resp-panel panel2">
              <h2>Une peinture sans compromis sur la qualité</h2>
              <ul>
                <li>Fort pouvoir couvrant</li>
                <li>Application facile</li>
                <li>Séchage rapide</li>
                <li>1 sous-couche puis seulement 2 couches de peinture</li>
                <li>Facile d’entretien</li>
              </ul>
            </div>
            <div className="resp-panel panel3">
              <h2>Un parcours pensé pour ne pas bouger de votre canapé</h2>
              <ul>
                <li>Quantités calculées automatiquement</li>
                <li>Pas de sur-achat, pas de manque</li>
                <li>Possibilité d’ajuster votre panier en fonction de ce que vous avez déjà chez vous</li>
              </ul>
            </div>
            <div className="resp-panel panel4">
              <h2>Des tarifs négociés par votre assureur</h2>
              <ul>
                <li>Dans le cadre du partenariat avec votre assureur, vous bénéficiez de tarifs négociés sur l’ensemble des peintures et produits nécessaires à votre remise en état.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 : Avis Vérifiés */}
      <section className="avis-section">
        <h2>Déjà 20 000 clients convaincus, pourquoi pas vous&nbsp;?</h2>
        <div className="skeepers_carousel_container" data-slides-count="3"></div>
      </section>

      {/* SECTION 5 : Réassurance */}
      <section className="reassurance-section">
        <div className="reassurance-grid">
          <div className="reassurance-item">
            <img src="/images-reassurance/paiement-securise.webp" alt="Paiement sécurisé" />
            <h3>Paiement sécurisé</h3>
            <p>Carte bancaire, PayPal, virement, paiement en 3x sans frais : vous choisissez votre mode de paiement.</p>
          </div>
          <div className="reassurance-item">
            <img src="/images-reassurance/livraison-rapide.webp" alt="Livraison rapide" />
            <h3>Livraison rapide</h3>
            <p>Livraison offerte en point relais dès 90€ d'achat.</p>
          </div>
          <div className="reassurance-item">
            <img src="/images-reassurance/sav-reactif.webp" alt="SAV réactif" />
            <h3>SAV réactif</h3>
            <p>Une question ? Contactez-nous au 05&nbsp;62&nbsp;14&nbsp;16&nbsp;46.<br />Nous sommes joignables du lundi au vendredi, de 9&nbsp;h à 18&nbsp;h.</p>
          </div>
        </div>
        
        {/* CTA secondaire en bas de page */}
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <Link href="/sinistre" className="cta-btn">
            Estimer mon projet
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <img src="/logo-colibri.png" alt="Logo" className="footer-logo" />
        <div className="footer-links">
          <a href="https://vztmja-iy.myshopify.com/policies/privacy-policy">Politique de confidentialité</a>
          <a href="https://vztmja-iy.myshopify.com/policies/terms-of-sale">Conditions générales de vente</a>
          <a href="https://vztmja-iy.myshopify.com/policies/legal-notice">Mentions légales</a>
          <a href="https://vztmja-iy.myshopify.com/policies/#shopifyReshowConsentBanner">Préférences en matière de cookies</a>
        </div>
      </footer>

      <Script 
        defer 
        charSet="utf-8" 
        src="//widgets.rr.skeepers.io/carousel/fd361f38-7a28-6934-85ca-28db47a817ea/10c0dd9f-ee71-44c0-b560-2e34e3e6a515.js" 
      />
    </div>
  );
}
