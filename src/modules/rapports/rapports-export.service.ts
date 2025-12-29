// ============================================
// FICHIER: src/modules/rapports/rapports-export.service.ts
// Service d'export pour les rapports (inventaire valorisé, etc.)
// ============================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService, ExportColumn, ExportFormat } from '../../common/services/export.service';
import { ExportRapportInventaireQueryDto } from '../../common/dto/export-query.dto';

@Injectable()
export class RapportsExportService {
  constructor(
    private prisma: PrismaService,
    private exportService: ExportService,
  ) {}

  // ============================================
  // INVENTAIRE VALORISÉ
  // ============================================

  /**
   * Colonnes pour le rapport d'inventaire valorisé
   */
  private getColumnsInventaireValorise(): ExportColumn[] {
    return [
      { header: 'Réf. Produit', key: 'reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'nom', width: 28, type: 'string' },
      { header: 'Catégorie', key: 'categorie', width: 18, type: 'string' },
      { header: 'Marque', key: 'marque', width: 15, type: 'string' },
      { header: 'Unité', key: 'uniteMesure', width: 10, type: 'string' },
      { header: 'Qté Stock', key: 'quantiteTotale', width: 12, type: 'number' },
      { header: 'Qté Réservée', key: 'quantiteReservee', width: 12, type: 'number' },
      { header: 'Qté Disponible', key: 'quantiteDisponible', width: 14, type: 'number' },
      { header: 'Coût Unitaire', key: 'coutUnitaire', width: 15, type: 'currency' },
      { header: 'Prix Vente', key: 'prixVente', width: 15, type: 'currency' },
      { header: 'Valeur Coût', key: 'valeurCout', width: 18, type: 'currency' },
      { header: 'Valeur Vente', key: 'valeurVente', width: 18, type: 'currency' },
      { header: 'Marge Potentielle', key: 'margePotentielle', width: 18, type: 'currency' },
      { header: '% Marge', key: 'pourcentageMarge', width: 10, type: 'percentage' },
      { header: 'Nb Entrepôts', key: 'nombreEntrepots', width: 12, type: 'number' },
    ];
  }

  /**
   * Récupérer les données pour l'inventaire valorisé
   */
  private async getDataInventaireValorise(
    filters: ExportRapportInventaireQueryDto,
  ): Promise<any[]> {
    // Récupérer tous les produits avec leur inventaire
    const whereInventaire: any = {};
    if (filters.entrepotId) {
      whereInventaire.entrepotId = filters.entrepotId;
    }

    const produits = await this.prisma.produit.findMany({
      where: {
        estActif: true,
        ...(filters.categorieId ? { categorieId: filters.categorieId } : {}),
      },
      include: {
        categorie: {
          select: { nom: true },
        },
        inventaire: {
          where: whereInventaire,
          select: {
            quantite: true,
            quantiteReservee: true,
            entrepotId: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });

    // Transformer et calculer les valorisations
    return produits.map((p) => {
      const quantiteTotale = p.inventaire.reduce((sum, i) => sum + i.quantite, 0);
      const quantiteReservee = p.inventaire.reduce((sum, i) => sum + i.quantiteReservee, 0);
      const quantiteDisponible = quantiteTotale - quantiteReservee;
      const coutUnitaire = Number(p.coutUnitaire || 0);
      const prixVente = Number(p.prixVente || 0);
      const valeurCout = quantiteTotale * coutUnitaire;
      const valeurVente = quantiteTotale * prixVente;
      const margePotentielle = valeurVente - valeurCout;
      const pourcentageMarge = valeurCout > 0 ? margePotentielle / valeurCout : 0;

      return {
        reference: p.reference,
        nom: p.nom,
        categorie: p.categorie?.nom || 'Non catégorisé',
        marque: p.marque || '-',
        uniteMesure: p.uniteMesure,
        quantiteTotale,
        quantiteReservee,
        quantiteDisponible,
        coutUnitaire,
        prixVente,
        valeurCout,
        valeurVente,
        margePotentielle,
        pourcentageMarge,
        nombreEntrepots: new Set(p.inventaire.map((i) => i.entrepotId)).size,
      };
    }).filter((p) => p.quantiteTotale > 0 || filters.entrepotId === undefined);
  }

  /**
   * Calculer les totaux pour l'inventaire valorisé
   */
  private getTotauxInventaireValorise(data: any[]): {
    subtitle: string;
    totaux: any;
  } {
    const totaux = {
      quantiteTotale: data.reduce((sum, p) => sum + p.quantiteTotale, 0),
      quantiteReservee: data.reduce((sum, p) => sum + p.quantiteReservee, 0),
      valeurCout: data.reduce((sum, p) => sum + p.valeurCout, 0),
      valeurVente: data.reduce((sum, p) => sum + p.valeurVente, 0),
      margePotentielle: data.reduce((sum, p) => sum + p.margePotentielle, 0),
    };

    const formatCurrency = (val: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val);

    const subtitle = `${data.length} produits | ${totaux.quantiteTotale} articles | Valeur coût: ${formatCurrency(totaux.valeurCout)} | Valeur vente: ${formatCurrency(totaux.valeurVente)} | Marge potentielle: ${formatCurrency(totaux.margePotentielle)}`;

    return { subtitle, totaux };
  }

  /**
   * Exporter l'inventaire valorisé
   */
  async exportInventaireValorise(
    filters: ExportRapportInventaireQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getDataInventaireValorise(filters);
    const { subtitle } = this.getTotauxInventaireValorise(data);

    let title = 'Rapport d\'Inventaire Valorisé';
    if (filters.methodeValorisation) {
      title += ` (Méthode ${filters.methodeValorisation})`;
    }

    await this.exportService.export(
      {
        filename: `inventaire_valorise_${new Date().toISOString().split('T')[0]}`,
        title,
        subtitle,
        columns: this.getColumnsInventaireValorise(),
        data,
        format,
        metadata: {
          generatedBy: 'Système de Gestion de Stock',
          company: 'Votre Entreprise',
        },
      },
      res,
    );
  }

  // ============================================
  // RAPPORT PAR CATÉGORIE
  // ============================================

  /**
   * Exporter l'inventaire valorisé groupé par catégorie
   */
  async exportInventaireParCategorie(
    filters: ExportRapportInventaireQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getDataInventaireValorise(filters);

    // Grouper par catégorie
    const parCategorie: Map<string, any> = new Map();

    for (const p of data) {
      const cat = p.categorie;
      if (!parCategorie.has(cat)) {
        parCategorie.set(cat, {
          categorie: cat,
          nombreProduits: 0,
          quantiteTotale: 0,
          valeurCout: 0,
          valeurVente: 0,
          margePotentielle: 0,
        });
      }

      const resume = parCategorie.get(cat);
      resume.nombreProduits++;
      resume.quantiteTotale += p.quantiteTotale;
      resume.valeurCout += p.valeurCout;
      resume.valeurVente += p.valeurVente;
      resume.margePotentielle += p.margePotentielle;
    }

    const dataCategorie = Array.from(parCategorie.values()).map((r) => ({
      ...r,
      pourcentageMarge: r.valeurCout > 0 ? r.margePotentielle / r.valeurCout : 0,
      partValeur: 0, // Sera calculé après
    }));

    // Calculer la part de chaque catégorie dans la valeur totale
    const valeurTotale = dataCategorie.reduce((sum, c) => sum + c.valeurCout, 0);
    dataCategorie.forEach((c) => {
      c.partValeur = valeurTotale > 0 ? c.valeurCout / valeurTotale : 0;
    });

    // Trier par valeur décroissante
    dataCategorie.sort((a, b) => b.valeurCout - a.valeurCout);

    const columnsCategorie: ExportColumn[] = [
      { header: 'Catégorie', key: 'categorie', width: 25, type: 'string' },
      { header: 'Nb Produits', key: 'nombreProduits', width: 12, type: 'number' },
      { header: 'Qté Totale', key: 'quantiteTotale', width: 12, type: 'number' },
      { header: 'Valeur Coût', key: 'valeurCout', width: 18, type: 'currency' },
      { header: 'Valeur Vente', key: 'valeurVente', width: 18, type: 'currency' },
      { header: 'Marge Potentielle', key: 'margePotentielle', width: 18, type: 'currency' },
      { header: '% Marge', key: 'pourcentageMarge', width: 10, type: 'percentage' },
      { header: '% Valeur Stock', key: 'partValeur', width: 12, type: 'percentage' },
    ];

    const formatCurrency = (val: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val);

    await this.exportService.export(
      {
        filename: `inventaire_par_categorie_${new Date().toISOString().split('T')[0]}`,
        title: 'Inventaire Valorisé par Catégorie',
        subtitle: `${dataCategorie.length} catégories | Valeur totale: ${formatCurrency(valeurTotale)}`,
        columns: columnsCategorie,
        data: dataCategorie,
        format,
        metadata: {
          generatedBy: 'Système de Gestion de Stock',
          company: 'Votre Entreprise',
        },
      },
      res,
    );
  }

  // ============================================
  // ANALYSE ABC
  // ============================================

  /**
   * Exporter l'analyse ABC de l'inventaire
   */
  async exportAnalyseABC(
    filters: ExportRapportInventaireQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getDataInventaireValorise(filters);

    // Trier par valeur décroissante
    data.sort((a, b) => b.valeurCout - a.valeurCout);

    // Calculer les cumuls et classer
    const valeurTotale = data.reduce((sum, p) => sum + p.valeurCout, 0);
    let cumulValeur = 0;

    const dataABC = data.map((p, index) => {
      cumulValeur += p.valeurCout;
      const pourcentageCumul = valeurTotale > 0 ? cumulValeur / valeurTotale : 0;

      let classe: string;
      if (pourcentageCumul <= 0.8) {
        classe = 'A'; // 80% de la valeur
      } else if (pourcentageCumul <= 0.95) {
        classe = 'B'; // 15% suivants
      } else {
        classe = 'C'; // 5% restants
      }

      return {
        rang: index + 1,
        reference: p.reference,
        nom: p.nom,
        categorie: p.categorie,
        quantiteTotale: p.quantiteTotale,
        valeurCout: p.valeurCout,
        pourcentageValeur: valeurTotale > 0 ? p.valeurCout / valeurTotale : 0,
        pourcentageCumul,
        classe,
      };
    });

    // Statistiques par classe
    const statsParClasse = {
      A: dataABC.filter((p) => p.classe === 'A'),
      B: dataABC.filter((p) => p.classe === 'B'),
      C: dataABC.filter((p) => p.classe === 'C'),
    };

    const formatCurrency = (val: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val);

    const subtitle = `Classe A: ${statsParClasse.A.length} produits (${formatCurrency(statsParClasse.A.reduce((s, p) => s + p.valeurCout, 0))}) | Classe B: ${statsParClasse.B.length} produits | Classe C: ${statsParClasse.C.length} produits`;

    const columnsABC: ExportColumn[] = [
      { header: 'Rang', key: 'rang', width: 8, type: 'number' },
      { header: 'Classe', key: 'classe', width: 8, type: 'string' },
      { header: 'Référence', key: 'reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'nom', width: 25, type: 'string' },
      { header: 'Catégorie', key: 'categorie', width: 18, type: 'string' },
      { header: 'Quantité', key: 'quantiteTotale', width: 12, type: 'number' },
      { header: 'Valeur Stock', key: 'valeurCout', width: 18, type: 'currency' },
      { header: '% Valeur', key: 'pourcentageValeur', width: 10, type: 'percentage' },
      { header: '% Cumulé', key: 'pourcentageCumul', width: 10, type: 'percentage' },
    ];

    await this.exportService.export(
      {
        filename: `analyse_abc_${new Date().toISOString().split('T')[0]}`,
        title: 'Analyse ABC de l\'Inventaire',
        subtitle,
        columns: columnsABC,
        data: dataABC,
        format,
        metadata: {
          generatedBy: 'Système de Gestion de Stock',
          company: 'Votre Entreprise',
        },
      },
      res,
    );
  }
}