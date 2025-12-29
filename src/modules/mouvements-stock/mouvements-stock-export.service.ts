// ============================================
// FICHIER: src/modules/mouvements-stock/mouvements-stock-export.service.ts
// Service d'export spécialisé pour les mouvements de stock
// ============================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService, ExportColumn, ExportFormat } from '../../common/services/export.service';
import { ExportMouvementsQueryDto } from '../../common/dto/export-query.dto';

@Injectable()
export class MouvementsStockExportService {
  constructor(
    private prisma: PrismaService,
    private exportService: ExportService,
  ) {}

  /**
   * Colonnes pour l'export des mouvements
   */
  private getColumns(): ExportColumn[] {
    return [
      { header: 'Date', key: 'dateMouvement', width: 18, type: 'date' },
      { header: 'Type', key: 'typeLabel', width: 12, type: 'string' },
      { header: 'Réf. Produit', key: 'produit.reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'produit.nom', width: 25, type: 'string' },
      { header: 'Quantité', key: 'quantiteSignee', width: 12, type: 'number' },
      { header: 'Coût Unitaire', key: 'coutUnitaire', width: 15, type: 'currency' },
      { header: 'Valeur Mouvement', key: 'valeurMouvement', width: 18, type: 'currency' },
      { header: 'Entrepôt', key: 'entrepot.nom', width: 18, type: 'string' },
      { header: 'Raison', key: 'raison', width: 30, type: 'string' },
      { header: 'Référence', key: 'typeReference', width: 15, type: 'string' },
      { header: 'Effectué par', key: 'utilisateur.nomComplet', width: 20, type: 'string' },
      { header: 'Notes', key: 'notes', width: 25, type: 'string' },
    ];
  }

  /**
   * Récupérer les données pour l'export
   */
  private async getData(filters: ExportMouvementsQueryDto): Promise<any[]> {
    const where: any = {};

    if (filters.typeMouvement) {
      where.typeMouvement = filters.typeMouvement;
    }

    if (filters.produitId) {
      where.produitId = filters.produitId;
    }

    if (filters.entrepotId) {
      where.entrepotId = filters.entrepotId;
    }

    if (filters.dateDebut || filters.dateFin) {
      where.dateMouvement = {};
      if (filters.dateDebut) {
        where.dateMouvement.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        where.dateMouvement.lte = new Date(filters.dateFin);
      }
    }

    const mouvements = await this.prisma.mouvementStock.findMany({
      where,
      include: {
        produit: {
          select: {
            id: true,
            reference: true,
            nom: true,
            uniteMesure: true,
          },
        },
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
        utilisateur: {
          select: {
            id: true,
            nomComplet: true,
          },
        },
      },
      orderBy: { dateMouvement: 'desc' },
    });

    // Transformer les données pour l'export
    return mouvements.map((m) => ({
      ...m,
      typeLabel: this.getTypeLabel(m.typeMouvement),
      quantiteSignee: this.getQuantiteSignee(m.typeMouvement, m.quantite),
      valeurMouvement: Number(m.quantite) * Number(m.coutUnitaire || 0),
    }));
  }

  /**
   * Obtenir le libellé du type de mouvement
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ENTREE: '📥 Entrée',
      SORTIE: '📤 Sortie',
      AJUSTEMENT: '🔧 Ajustement',
      TRANSFERT: '🔄 Transfert',
      RETOUR: '↩️ Retour',
    };
    return labels[type] || type;
  }

  /**
   * Obtenir la quantité avec signe (+ pour entrées, - pour sorties)
   */
  private getQuantiteSignee(type: string, quantite: number): number {
    const typesNegatifs = ['SORTIE'];
    return typesNegatifs.includes(type) ? -quantite : quantite;
  }

  /**
   * Calculer les statistiques pour le sous-titre
   */
  private getStatistiques(data: any[]): string {
    const total = data.length;
    const entrees = data.filter((m) => m.typeMouvement === 'ENTREE').length;
    const sorties = data.filter((m) => m.typeMouvement === 'SORTIE').length;
    const valeurEntrees = data
      .filter((m) => m.typeMouvement === 'ENTREE')
      .reduce((sum, m) => sum + m.valeurMouvement, 0);
    const valeurSorties = data
      .filter((m) => m.typeMouvement === 'SORTIE')
      .reduce((sum, m) => sum + m.valeurMouvement, 0);

    return `${total} mouvements | ${entrees} entrées (${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(valeurEntrees)}) | ${sorties} sorties (${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(valeurSorties)})`;
  }

  /**
   * Exporter les mouvements de stock
   */
  async export(
    filters: ExportMouvementsQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getData(filters);
    const subtitle = this.getStatistiques(data);

    // Construire le titre avec la période si spécifiée
    let title = 'Historique des Mouvements de Stock';
    if (filters.dateDebut || filters.dateFin) {
      const debut = filters.dateDebut
        ? new Date(filters.dateDebut).toLocaleDateString('fr-FR')
        : 'Début';
      const fin = filters.dateFin
        ? new Date(filters.dateFin).toLocaleDateString('fr-FR')
        : "Aujourd'hui";
      title += ` (${debut} - ${fin})`;
    }

    await this.exportService.export(
      {
        filename: `mouvements_stock_${new Date().toISOString().split('T')[0]}`,
        title,
        subtitle,
        columns: this.getColumns(),
        data,
        format,
        metadata: {
          generatedBy: 'Système de Gestion de Stock',
          company: 'Votre Entreprise',
          dateRange: {
            start: filters.dateDebut ? new Date(filters.dateDebut) : undefined,
            end: filters.dateFin ? new Date(filters.dateFin) : undefined,
          },
        },
      },
      res,
    );
  }

  /**
   * Exporter un résumé par produit
   */
  async exportResumeProduit(
    filters: ExportMouvementsQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const mouvements = await this.getData(filters);

    // Grouper par produit
    const resumeParProduit: Map<number, any> = new Map();

    for (const m of mouvements) {
      const produitId = m.produitId;
      if (!resumeParProduit.has(produitId)) {
        resumeParProduit.set(produitId, {
          reference: m.produit.reference,
          nom: m.produit.nom,
          totalEntrees: 0,
          totalSorties: 0,
          totalAjustements: 0,
          valeurEntrees: 0,
          valeurSorties: 0,
          nombreMouvements: 0,
        });
      }

      const resume = resumeParProduit.get(produitId);
      resume.nombreMouvements++;

      if (m.typeMouvement === 'ENTREE') {
        resume.totalEntrees += m.quantite;
        resume.valeurEntrees += m.valeurMouvement;
      } else if (m.typeMouvement === 'SORTIE') {
        resume.totalSorties += m.quantite;
        resume.valeurSorties += m.valeurMouvement;
      } else if (m.typeMouvement === 'AJUSTEMENT') {
        resume.totalAjustements += m.quantiteSignee;
      }
    }

    const dataResume = Array.from(resumeParProduit.values()).map((r) => ({
      ...r,
      solde: r.totalEntrees - r.totalSorties + r.totalAjustements,
      soldeValeur: r.valeurEntrees - r.valeurSorties,
    }));

    const columnsResume: ExportColumn[] = [
      { header: 'Référence', key: 'reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'nom', width: 25, type: 'string' },
      { header: 'Nb Mouvements', key: 'nombreMouvements', width: 15, type: 'number' },
      { header: 'Total Entrées', key: 'totalEntrees', width: 15, type: 'number' },
      { header: 'Total Sorties', key: 'totalSorties', width: 15, type: 'number' },
      { header: 'Ajustements', key: 'totalAjustements', width: 15, type: 'number' },
      { header: 'Solde Qté', key: 'solde', width: 12, type: 'number' },
      { header: 'Valeur Entrées', key: 'valeurEntrees', width: 18, type: 'currency' },
      { header: 'Valeur Sorties', key: 'valeurSorties', width: 18, type: 'currency' },
      { header: 'Solde Valeur', key: 'soldeValeur', width: 18, type: 'currency' },
    ];

    await this.exportService.export(
      {
        filename: `mouvements_resume_${new Date().toISOString().split('T')[0]}`,
        title: 'Résumé des Mouvements par Produit',
        subtitle: `${dataResume.length} produits concernés`,
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