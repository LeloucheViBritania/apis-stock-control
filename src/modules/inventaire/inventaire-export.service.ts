// ============================================
// FICHIER: src/modules/inventaire/inventaire-export.service.ts
// Service d'export spécialisé pour l'inventaire
// ============================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService, ExportColumn, ExportFormat } from '../../common/services/export.service';
import { ExportInventaireQueryDto } from '../../common/dto/export-query.dto';

@Injectable()
export class InventaireExportService {
  constructor(
    private prisma: PrismaService,
    private exportService: ExportService,
  ) {}

  /**
   * Colonnes pour l'export de l'inventaire
   */
  private getColumns(): ExportColumn[] {
    return [
      { header: 'Entrepôt', key: 'entrepot.nom', width: 20, type: 'string' },
      { header: 'Code Entrepôt', key: 'entrepot.code', width: 12, type: 'string' },
      { header: 'Réf. Produit', key: 'produit.reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'produit.nom', width: 25, type: 'string' },
      { header: 'Catégorie', key: 'produit.categorie.nom', width: 18, type: 'string' },
      { header: 'Emplacement', key: 'emplacement', width: 12, type: 'string' },
      { header: 'Quantité', key: 'quantite', width: 12, type: 'number' },
      { header: 'Qté Réservée', key: 'quantiteReservee', width: 12, type: 'number' },
      { header: 'Qté Disponible', key: 'quantiteDisponible', width: 14, type: 'number' },
      { header: 'Stock Min', key: 'produit.niveauStockMin', width: 10, type: 'number' },
      { header: 'Stock Max', key: 'produit.niveauStockMax', width: 10, type: 'number' },
      { header: 'Coût Unitaire', key: 'produit.coutUnitaire', width: 15, type: 'currency' },
      { header: 'Valeur Stock', key: 'valeurStock', width: 18, type: 'currency' },
      { header: 'Statut', key: 'statut', width: 15, type: 'string' },
      { header: 'Dernière Vérif.', key: 'derniereVerification', width: 15, type: 'date' },
    ];
  }

  /**
   * Récupérer les données pour l'export
   */
  private async getData(filters: ExportInventaireQueryDto): Promise<any[]> {
    const where: any = {};

    if (filters.entrepotId) {
      where.entrepotId = filters.entrepotId;
    }

    const inventaire = await this.prisma.inventaire.findMany({
      where,
      include: {
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
            ville: true,
          },
        },
        produit: {
          select: {
            id: true,
            reference: true,
            nom: true,
            niveauStockMin: true,
            niveauStockMax: true,
            coutUnitaire: true,
            prixVente: true,
            uniteMesure: true,
            categorie: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        },
      },
      orderBy: [
        { entrepot: { nom: 'asc' } },
        { produit: { nom: 'asc' } },
      ],
    });

    // Filtrer après récupération si nécessaire (stock faible, ruptures)
    let result = inventaire;

    if (filters.stockFaible === 'true') {
      result = result.filter(
        (i) => i.quantite > 0 && i.quantite <= i.produit.niveauStockMin,
      );
    }

    if (filters.ruptures === 'true') {
      result = result.filter((i) => i.quantite === 0);
    }

    // Transformer les données pour l'export
    return result.map((i) => ({
      ...i,
      quantiteDisponible: i.quantite - i.quantiteReservee,
      valeurStock: Number(i.quantite) * Number(i.produit.coutUnitaire || 0),
      statut: this.getStatutStock(i),
    }));
  }

  /**
   * Déterminer le statut du stock
   */
  private getStatutStock(inventaire: any): string {
    if (inventaire.quantite === 0) return '🔴 Rupture';
    if (inventaire.quantite <= inventaire.produit.niveauStockMin) return '🟠 Stock Faible';
    if (
      inventaire.produit.niveauStockMax &&
      inventaire.quantite >= inventaire.produit.niveauStockMax
    ) {
      return '🟣 Surstock';
    }
    if (inventaire.quantiteReservee > 0) return '🔵 Partiellement Réservé';
    return '🟢 Normal';
  }

  /**
   * Calculer les statistiques pour le sous-titre
   */
  private getStatistiques(data: any[]): string {
    const totalLignes = data.length;
    const ruptures = data.filter((i) => i.quantite === 0).length;
    const stockFaible = data.filter(
      (i) => i.quantite > 0 && i.quantite <= i.produit.niveauStockMin,
    ).length;
    const valeurTotale = data.reduce((sum, i) => sum + i.valeurStock, 0);
    const quantiteTotale = data.reduce((sum, i) => sum + i.quantite, 0);

    return `${totalLignes} lignes | ${quantiteTotale} articles | ${ruptures} ruptures | ${stockFaible} alertes | Valeur: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(valeurTotale)}`;
  }

  /**
   * Exporter l'inventaire
   */
  async export(
    filters: ExportInventaireQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getData(filters);
    const subtitle = this.getStatistiques(data);

    let title = 'État de l\'Inventaire';
    if (filters.entrepotId) {
      const entrepot = data[0]?.entrepot;
      if (entrepot) {
        title += ` - ${entrepot.nom}`;
      }
    }

    await this.exportService.export(
      {
        filename: `inventaire_${new Date().toISOString().split('T')[0]}`,
        title,
        subtitle,
        columns: this.getColumns(),
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

  /**
   * Exporter un résumé par entrepôt
   */
  async exportResumeParEntrepot(
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const inventaire = await this.prisma.inventaire.findMany({
      include: {
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
            ville: true,
            capacite: true,
          },
        },
        produit: {
          select: {
            coutUnitaire: true,
            niveauStockMin: true,
          },
        },
      },
    });

    // Grouper par entrepôt
    const resumeParEntrepot: Map<number, any> = new Map();

    for (const i of inventaire) {
      const entrepotId = i.entrepotId;
      if (!resumeParEntrepot.has(entrepotId)) {
        resumeParEntrepot.set(entrepotId, {
          nom: i.entrepot.nom,
          code: i.entrepot.code,
          ville: i.entrepot.ville,
          capacite: i.entrepot.capacite,
          nombreProduits: 0,
          quantiteTotale: 0,
          quantiteReservee: 0,
          valeurTotale: 0,
          ruptures: 0,
          alertes: 0,
        });
      }

      const resume = resumeParEntrepot.get(entrepotId);
      resume.nombreProduits++;
      resume.quantiteTotale += i.quantite;
      resume.quantiteReservee += i.quantiteReservee;
      resume.valeurTotale += Number(i.quantite) * Number(i.produit.coutUnitaire || 0);

      if (i.quantite === 0) {
        resume.ruptures++;
      } else if (i.quantite <= i.produit.niveauStockMin) {
        resume.alertes++;
      }
    }

    const dataResume = Array.from(resumeParEntrepot.values()).map((r) => ({
      ...r,
      tauxOccupation: r.capacite
        ? ((r.quantiteTotale / r.capacite) * 100).toFixed(1) + '%'
        : 'N/A',
    }));

    const columnsResume: ExportColumn[] = [
      { header: 'Entrepôt', key: 'nom', width: 20, type: 'string' },
      { header: 'Code', key: 'code', width: 10, type: 'string' },
      { header: 'Ville', key: 'ville', width: 15, type: 'string' },
      { header: 'Nb Produits', key: 'nombreProduits', width: 12, type: 'number' },
      { header: 'Qté Totale', key: 'quantiteTotale', width: 12, type: 'number' },
      { header: 'Qté Réservée', key: 'quantiteReservee', width: 12, type: 'number' },
      { header: 'Capacité', key: 'capacite', width: 10, type: 'number' },
      { header: 'Taux Occup.', key: 'tauxOccupation', width: 12, type: 'string' },
      { header: 'Ruptures', key: 'ruptures', width: 10, type: 'number' },
      { header: 'Alertes', key: 'alertes', width: 10, type: 'number' },
      { header: 'Valeur Stock', key: 'valeurTotale', width: 18, type: 'currency' },
    ];

    await this.exportService.export(
      {
        filename: `inventaire_resume_entrepots_${new Date().toISOString().split('T')[0]}`,
        title: 'Résumé de l\'Inventaire par Entrepôt',
        subtitle: `${dataResume.length} entrepôts`,
        columns: columnsResume,
        data: dataResume,
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