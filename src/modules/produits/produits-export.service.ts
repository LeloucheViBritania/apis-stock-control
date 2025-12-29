// ============================================
// FICHIER: src/modules/produits/produits-export.service.ts
// Service d'export spécialisé pour les produits
// ============================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService, ExportColumn, ExportFormat } from '../../common/services/export.service';
import { ExportProduitsQueryDto } from '../../common/dto/export-query.dto';

@Injectable()
export class ProduitsExportService {
  constructor(
    private prisma: PrismaService,
    private exportService: ExportService,
  ) {}

  /**
   * Colonnes pour l'export des produits
   */
  private getColumns(): ExportColumn[] {
    return [
      { header: 'Référence', key: 'reference', width: 15, type: 'string' },
      { header: 'Nom', key: 'nom', width: 30, type: 'string' },
      { header: 'Catégorie', key: 'categorie.nom', width: 20, type: 'string' },
      { header: 'Marque', key: 'marque', width: 15, type: 'string' },
      { header: 'Unité', key: 'uniteMesure', width: 10, type: 'string' },
      { header: 'Stock Actuel', key: 'quantiteStock', width: 12, type: 'number' },
      { header: 'Stock Min', key: 'niveauStockMin', width: 10, type: 'number' },
      { header: 'Stock Max', key: 'niveauStockMax', width: 10, type: 'number' },
      { header: 'Point Commande', key: 'pointCommande', width: 12, type: 'number' },
      { header: 'Coût Unitaire', key: 'coutUnitaire', width: 15, type: 'currency' },
      { header: 'Prix Vente', key: 'prixVente', width: 15, type: 'currency' },
      { header: 'Valeur Stock', key: 'valeurStock', width: 18, type: 'currency' },
      { header: 'Statut', key: 'statut', width: 12, type: 'string' },
      { header: 'Date Création', key: 'dateCreation', width: 15, type: 'date' },
    ];
  }

  /**
   * Récupérer les données pour l'export
   */
  private async getData(filters: ExportProduitsQueryDto): Promise<any[]> {
    const where: any = {};

    if (filters.categorieId) {
      where.categorieId = filters.categorieId;
    }

    if (filters.estActif !== undefined) {
      where.estActif = filters.estActif === 'true';
    }

    // Filtrer les stocks faibles
    if (filters.stockFaible === 'true') {
      where.quantiteStock = {
        lte: this.prisma.produit.fields.niveauStockMin,
      };
    }

    const produits = await this.prisma.produit.findMany({
      where,
      include: {
        categorie: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });

    // Transformer les données pour l'export
    return produits.map((p) => ({
      ...p,
      valeurStock: Number(p.quantiteStock) * Number(p.coutUnitaire || 0),
      statut: this.getStatutStock(p),
    }));
  }

  /**
   * Déterminer le statut du stock
   */
  private getStatutStock(produit: any): string {
    if (produit.quantiteStock === 0) return '🔴 Rupture';
    if (produit.quantiteStock <= produit.niveauStockMin) return '🟠 Stock Faible';
    if (produit.quantiteStock >= (produit.niveauStockMax || Infinity)) return '🟣 Surstock';
    return '🟢 Normal';
  }

  /**
   * Calculer les statistiques pour le sous-titre
   */
  private async getStatistiques(data: any[]): Promise<string> {
    const total = data.length;
    const ruptures = data.filter((p) => p.quantiteStock === 0).length;
    const stockFaible = data.filter(
      (p) => p.quantiteStock > 0 && p.quantiteStock <= p.niveauStockMin,
    ).length;
    const valeurTotale = data.reduce((sum, p) => sum + p.valeurStock, 0);

    return `${total} produits | ${ruptures} ruptures | ${stockFaible} en alerte | Valeur: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(valeurTotale)}`;
  }

  /**
   * Exporter les produits
   */
  async export(
    filters: ExportProduitsQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getData(filters);
    const subtitle = await this.getStatistiques(data);

    await this.exportService.export(
      {
        filename: `produits_${new Date().toISOString().split('T')[0]}`,
        title: 'Liste des Produits',
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
}