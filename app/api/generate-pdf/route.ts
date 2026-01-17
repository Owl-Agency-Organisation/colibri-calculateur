import { NextRequest, NextResponse } from 'next/server';
import type { Assure, Piece } from '@/lib/types';
import type { ResultatCalcul } from '@/lib/calcul';

interface PdfRequestBody {
  assure: Assure;
  pieces: Piece[];
  resultat: ResultatCalcul;
  options: {
    sousCouche: boolean;
    kit: boolean;
  };
}

/**
 * Génère un PDF de commande avec les détails du sinistre
 * Utilise une approche HTML -> PDF via le navigateur
 */
export async function POST(request: NextRequest) {
  try {
    const body: PdfRequestBody = await request.json();
    const { assure, pieces, resultat, options } = body;

    // Générer le HTML du PDF
    const html = generatePdfHtml(assure, pieces, resultat, options);

    // Retourner le HTML pour génération côté client
    // Note: Dans une version production, on utiliserait puppeteer ou une API PDF
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF' },
      { status: 500 }
    );
  }
}

function generatePdfHtml(
  assure: Assure,
  pieces: Piece[],
  resultat: ResultatCalcul,
  options: { sousCouche: boolean; kit: boolean }
): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const numeroCommande = `COL-${Date.now().toString(36).toUpperCase()}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande Colibri - ${numeroCommande}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2E7D32;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2E7D32;
    }
    .logo span {
      color: #81C784;
    }
    .document-info {
      text-align: right;
    }
    .document-info h1 {
      font-size: 20px;
      color: #2E7D32;
      margin-bottom: 5px;
    }
    .document-info p {
      color: #666;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #2E7D32;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 1px solid #E8F5E9;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .info-item p {
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #E8F5E9;
      color: #2E7D32;
      font-weight: 600;
      text-align: left;
      padding: 10px;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .product-name {
      font-weight: 500;
    }
    .product-desc {
      font-size: 11px;
      color: #666;
      margin-top: 3px;
    }
    .quantity {
      text-align: center;
      font-weight: 500;
    }
    .summary-box {
      background-color: #F5F5F5;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-weight: bold;
      font-size: 14px;
    }
    .pieces-list {
      margin-top: 10px;
    }
    .piece-item {
      background-color: #F9FBE7;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .piece-item h4 {
      font-size: 13px;
      margin-bottom: 8px;
    }
    .piece-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 11px;
    }
    .piece-detail label {
      color: #666;
      display: block;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 10px;
    }
    .footer p {
      margin-bottom: 5px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }
    .badge-green {
      background-color: #E8F5E9;
      color: #2E7D32;
    }
    .badge-blue {
      background-color: #E3F2FD;
      color: #1565C0;
    }
    @media print {
      body {
        padding: 20px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      Colibri<span>.</span>
      <div style="font-size: 11px; font-weight: normal; color: #666; margin-top: 5px;">
        Peintures biosourcées
      </div>
    </div>
    <div class="document-info">
      <h1>Bon de commande</h1>
      <p><strong>N° ${numeroCommande}</strong></p>
      <p>Date : ${date}</p>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Informations assuré</h2>
    <div class="info-grid">
      <div class="info-item">
        <label>Nom complet</label>
        <p>${assure.civilite} ${assure.prenom} ${assure.nom}</p>
      </div>
      <div class="info-item">
        <label>Email</label>
        <p>${assure.email}</p>
      </div>
      <div class="info-item">
        <label>Téléphone</label>
        <p>${assure.telephone}</p>
      </div>
      ${assure.adresse ? `
      <div class="info-item">
        <label>Adresse</label>
        <p>${assure.adresse}${assure.codePostal ? `, ${assure.codePostal}` : ''}${assure.ville ? ` ${assure.ville}` : ''}</p>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Détail des pièces</h2>
    <div class="pieces-list">
      ${pieces.map(piece => `
        <div class="piece-item">
          <h4>${piece.nom} <span class="badge badge-green">${piece.typePiece}</span></h4>
          <div class="piece-details">
            <div>
              <label>Murs</label>
              <strong>${piece.surfaceMurs} m²</strong>
              <div style="color: #666;">${piece.couleurMurs.titre}</div>
            </div>
            ${piece.surfacePlafond && piece.couleurPlafond ? `
            <div>
              <label>Plafond</label>
              <strong>${piece.surfacePlafond} m²</strong>
              <div style="color: #666;">${piece.couleurPlafond.titre}</div>
            </div>
            ` : ''}
            ${piece.surfaceBoiseries && piece.couleurBoiseries ? `
            <div>
              <label>Boiseries</label>
              <strong>${piece.surfaceBoiseries} m²</strong>
              <div style="color: #666;">${piece.couleurBoiseries.titre}</div>
            </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Produits commandés</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 50%">Produit</th>
          <th style="width: 25%">Détail</th>
          <th style="width: 25%; text-align: center;">Quantité</th>
        </tr>
      </thead>
      <tbody>
        ${resultat.peintures.map(peinture => `
          <tr>
            <td>
              <div class="product-name">${peinture.couleur.titre}</div>
              <div class="product-desc">Peinture biosourcée - ${peinture.couleur.collection}</div>
            </td>
            <td>
              <div>${peinture.surfaceTotale.toFixed(1)} m²</div>
              <div class="product-desc">${peinture.contenants.map(c => `${c.quantite}×${c.contenance}`).join(' + ')}</div>
            </td>
            <td class="quantity">${peinture.litresCommandes}L</td>
          </tr>
        `).join('')}
        ${options.sousCouche ? resultat.sousCouches.map(sc => `
          <tr>
            <td>
              <div class="product-name">Sous-couche ${sc.type}</div>
              <div class="product-desc">Peinture biosourcée murs et plafonds</div>
            </td>
            <td>
              <div>${sc.surfaceTotale.toFixed(1)} m²</div>
              <div class="product-desc">${sc.contenants.map(c => `${c.quantite}×${c.contenance}`).join(' + ')}</div>
            </td>
            <td class="quantity">${sc.litresCommandes}L</td>
          </tr>
        `).join('') : ''}
        ${options.kit ? `
          <tr>
            <td>
              <div class="product-name">${resultat.kit.titre}</div>
              <div class="product-desc">Matériel de peinture complet</div>
            </td>
            <td>
              <div>Surface ${resultat.kit.type === 'petite' ? '≤ 30' : '> 30'} m²</div>
            </td>
            <td class="quantity">1</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Récapitulatif</h2>
    <div class="summary-box">
      <div class="summary-row">
        <span>Nombre de pièces</span>
        <span>${resultat.resume.nombrePieces}</span>
      </div>
      <div class="summary-row">
        <span>Nombre de couleurs</span>
        <span>${resultat.resume.nombreCouleurs}</span>
      </div>
      <div class="summary-row">
        <span>Surface murs</span>
        <span>${resultat.resume.surfaceMurs.toFixed(1)} m²</span>
      </div>
      ${resultat.resume.surfacePlafonds > 0 ? `
      <div class="summary-row">
        <span>Surface plafonds</span>
        <span>${resultat.resume.surfacePlafonds.toFixed(1)} m²</span>
      </div>
      ` : ''}
      ${resultat.resume.surfaceBoiseries > 0 ? `
      <div class="summary-row">
        <span>Surface boiseries</span>
        <span>${resultat.resume.surfaceBoiseries.toFixed(1)} m²</span>
      </div>
      ` : ''}
      <div class="summary-row">
        <span>Surface totale</span>
        <span>${resultat.surfaceTotale.toFixed(1)} m²</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <p><strong>Colibri - Peintures biosourcées</strong></p>
    <p>Document généré automatiquement le ${date}</p>
    <p>Pour toute question, contactez-nous : contact@colibri-peintures.fr</p>
  </div>

  <script>
    // Auto-print si ouvert dans une nouvelle fenêtre
    if (window.opener) {
      window.print();
    }
  </script>
</body>
</html>
  `.trim();
}
