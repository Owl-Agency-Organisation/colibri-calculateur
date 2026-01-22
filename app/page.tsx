'use client';

import React from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <style jsx global>{`
        /* ----------- GLOBAL ----------- */
        .landing-page {
          margin: 0;
          font-family: 'Raleway', sans-serif;
          background-color: #f9f9f9;
          color: #1a1a1a;
          padding: 40px 20px;
          text-align: center;
        }

        .logo {
          margin-bottom: 30px;
        }

        .logo img {
          height: 40px;
          width: auto;
          display: block;
          margin: 0 auto;
        }

        h1 {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        p {
          font-size: 18px;
          line-height: 1.6;
          max-width: 600px;
          margin: 0 auto 12px;
        }

        /* SECTION HERO FUSIONNÉE */
        .hero-section {
          background-color: #d5f3f0;
          padding: 50px 20px;
        }

        .hero-layout {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 60px;
        }

        .hero-text {
          flex: 1;
          text-align: left;
        }

        .hero-text h1 {
          font-size: 42px;
          margin-bottom: 24px;
          color: #003f3d;
          line-height: 1.2;
        }

        .hero-text p {
          font-size: 20px;
          margin-bottom: 20px;
          color: #004b48;
          line-height: 1.6;
        }

        .cta-btn {
          display: inline-block;
          background-color: #007c7a;
          color: #fff;
          padding: 16px 36px;
          border-radius: 8px;
          border: none;
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
          margin-top: 10px;
          text-decoration: none;
        }

        .cta-btn:hover {
          background-color: #005f5d;
        }

        .hero-image {
          flex: 1;
          aspect-ratio: 1 / 1;
          background-image: url("/images/image-0.webp");
          background-size: cover;
          background-position: center;
          border-radius: 12px;
        }

        @media (max-width: 900px) {
          .hero-layout {
            flex-direction: column;
            text-align: left;
          }
          .hero-image {
            width: 100%;
          }
        }

        .steps-section {
          padding: 60px 20px;
          text-align: center;
          background-color: #f9f9f9;
        }

        .steps-section h2 {
          font-size: 28px;
          margin-bottom: 10px;
        }

        .steps-section p {
          font-size: 18px;
          margin-bottom: 40px;
        }

        .step-number {
          font-family: Host Grotesk, sans-serif;
          font-size: 60px;
          font-weight: 700;
          color: #007c7a;
          margin-bottom: 20px;
          line-height: 1;
        }

        @media (min-width: 900px) {
          .steps-tabs {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 32px;
            max-width: 1100px;
            margin: 40px auto 0;
          }
          .tab-content {
            display: block !important;
            background: #fff;
            padding: 30px 20px;
            border-radius: 12px;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
            text-align: center;
            border: 1px solid transparent;
            transition: border-color 0.25s ease, box-shadow 0.25s ease;
          }
          .tab-content:hover {
            border-color: #007c7a;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          }
          .tab-title, .steps-tabs input {
            display: none !important;
          }
        }

        @media (max-width: 899px) {
          .steps-tabs input {
            display: none;
          }
          .tab-title {
            display: block;
            padding: 14px;
            background: #e8f7f6;
            margin: 10px 0 0;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
          }
          .tab-content {
            display: none;
            background: #fff;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
          }
          .steps-tabs input:checked + .tab-title + .tab-content {
            display: block;
          }
          .steps-tabs input:checked + .tab-title {
            background: #ffffff;
            font-weight: 700;
            border: 1px solid #ddd;
          }
        }

        .responsable-section {
          padding: 10px 20px;
          background-color: #f9f9f9;
        }

        .responsable-section input[type="radio"] {
          display: none;
        }

        .responsable-layout {
          max-width: 1100px;
          padding-bottom: 80px;
          margin: 0 auto;
          display: flex;
          gap: 32px;
          align-items: stretch;
        }

        .responsable-image {
          flex: 1;
          aspect-ratio: 1 / 1;
          width: 100%;
          border-radius: 8px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }

        #resp1:checked ~ .responsable-layout .responsable-image { background-image: url("/images/image-1.webp"); }
        #resp2:checked ~ .responsable-layout .responsable-image { background-image: url("/images/image-2.webp"); }
        #resp3:checked ~ .responsable-layout .responsable-image { background-image: url("/images/image-3.webp"); }
        #resp4:checked ~ .responsable-layout .responsable-image { background-image: url("/images/image-4.webp"); }

        .responsable-content {
          flex: 2;
          display: flex;
          align-items: stretch;
        }

        .resp-panel {
          display: none;
          flex: 1;
          background: #fff;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0,0,0,0.05);
          box-sizing: border-box;
          flex-direction: column;
          justify-content: center;
          text-align: left;
        }

        .resp-panel h2 { font-size: 24px; margin-bottom: 16px; }
        .resp-panel ul { list-style: disc; padding-left: 20px; margin: 0; font-size: 16px; line-height: 1.6; }
        .resp-panel ul li { margin-bottom: 8px; }

        #resp1:checked ~ .responsable-layout .panel1 { display: flex; }
        #resp2:checked ~ .responsable-layout .panel2 { display: flex; }
        #resp3:checked ~ .responsable-layout .panel3 { display: flex; }
        #resp4:checked ~ .responsable-layout .panel4 { display: flex; }

        .resp-tabs-nav {
          max-width: 1000px;
          padding-bottom: 30px;
          margin: 30px auto 0;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
        }

        .resp-tabs-nav label {
          cursor: pointer;
          padding: 8px 14px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        #resp1:checked ~ .resp-tabs-nav label[for="resp1"],
        #resp2:checked ~ .resp-tabs-nav label[for="resp2"],
        #resp3:checked ~ .resp-tabs-nav label[for="resp3"],
        #resp4:checked ~ .resp-tabs-nav label[for="resp4"] {
          background: #d2f0ee;
          border-color: #333;
          font-weight: 700;
        }

        @media (max-width: 800px) {
          .responsable-layout { flex-direction: column; }
        }

        .avis-section {
          padding: 60px 20px;
          background-color: #e8f7f6;
          text-align: center;
        }

        .avis-section h2 { font-size: 28px; margin-bottom: 40px; }

        .reassurance-section {
          padding: 60px 20px;
          background-color: #f9f9f9;
        }

        .reassurance-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          gap: 32px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .reassurance-item {
          flex: 1;
          min-width: 280px;
          max-width: 400px;
          text-align: center;
        }

        .reassurance-item img {
          width: 200px;
          max-width: 100%;
          height: auto;
          margin-bottom: 20px;
        }

        .reassurance-item h3 { font-size: 18px; margin-bottom: 12px; color: #007c7a; }
        .reassurance-item p { font-size: 15px; line-height: 1.5; color: #333; }

        .site-footer {
          padding: 40px 20px;
          background-color: #f4f4f4;
          text-align: center;
        }

        .footer-logo {
          width: 150px;
          height: auto;
          opacity: 1;
          margin-bottom: 20px;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .footer-links a {
          font-size: 13px;
          color: #555;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-links a:hover { color: #007c7a; }
      `}</style>

      {/* SECTION 1 : Intro */}
      <div className="logo">
        <img src="/logo-colibri.png" alt="Logo Colibri" />
      </div>

      <section className="hero-section">
        <div className="hero-layout">
          <div className="hero-text">
            <h1>Dans le cadre de <br /> votre auto-réparation</h1>
            <p>Suite à votre sinistre, votre assureur vous a proposé de choisir votre peinture directement chez Colibri Peinture.</p>
            <p>Nous avons conçu <b>un parcours clair et guidé</b> pour vous permettre de remettre votre intérieur en état, sans prise de tête.</p>
            <p>Ici, <b>pas de calcul compliqué</b> ni de jargon technique. Vous indiquez vos pièces, vos surfaces, vos couleurs... Nous nous occupons du reste !</p>

            <Link href="/sinistre" className="cta-btn">
              Commencer
            </Link>
          </div>
          <div className="hero-image"></div>
        </div>
      </section>

      {/* SECTION 2 : Étapes */}
      <section className="steps-section">
        <h2>Comment ça marche ?</h2>
        <p>En <b>seulement 4 étapes</b>, recevez tout ce dont vous avez besoin chez vous !</p>

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
