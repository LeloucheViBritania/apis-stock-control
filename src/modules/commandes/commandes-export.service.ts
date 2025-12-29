// ============================================
// FICHIER: src/modules/commandes/commandes-export.service.ts
// Service d'export spécialisé pour les commandes
// ============================================

import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportService, ExportColumn, ExportFormat } from '../../common/services/export.service';
import { ExportCommandesQueryDto } from '../../common/dto/export-query.dto';

@Injectable()
export class CommandesExportService {
  constructor(
    private prisma: PrismaService,
    private exportService: ExportService,
  ) {}

  /**
   * Colonnes pour l'export des commandes
   */
  private getColumns(): ExportColumn[] {
    return [
      { header: 'N° Commande', key: 'numeroCommande', width: 18, type: 'string' },
      { header: 'Date Commande', key: 'dateCommande', width: 15, type: 'date' },
      { header: 'Date Livraison', key: 'dateLivraison', width: 15, type: 'date' },
      { header: 'Client', key: 'client.nom', width: 25, type: 'string' },
      { header: 'Email Client', key: 'client.email', width: 25, type: 'string' },
      { header: 'Téléphone', key: 'client.telephone', width: 15, type: 'string' },
      { header: 'Ville', key: 'client.ville', width: 15, type: 'string' },
      { header: 'Nb Articles', key: 'nombreArticles', width: 12, type: 'number' },
      { header: 'Montant Total', key: 'montantTotal', width: 18, type: 'currency' },
      { header: 'Statut', key: 'statutLabel', width: 15, type: 'string' },
      { header: 'Créé par', key: 'createur.nomComplet', width: 20, type: 'string' },
      { header: 'Date Création', key: 'dateCreation', width: 18, type: 'date' },
    ];
  }

  /**
   * Colonnes détaillées (avec lignes de commande)
   */
  private getColumnsDetaillees(): ExportColumn[] {
    return [
      { header: 'N° Commande', key: 'numeroCommande', width: 18, type: 'string' },
      { header: 'Date Commande', key: 'dateCommande', width: 15, type: 'date' },
      { header: 'Client', key: 'client.nom', width: 20, type: 'string' },
      { header: 'Réf. Produit', key: 'produit.reference', width: 15, type: 'string' },
      { header: 'Produit', key: 'produit.nom', width: 25, type: 'string' },
      { header: 'Quantité', key: 'quantite', width: 10, type: 'number' },
      { header: 'Prix Unitaire', key: 'prixUnitaire', width: 15, type: 'currency' },
      { header: 'Sous-Total', key: 'sousTotal', width: 15, type: 'currency' },
      { header: 'Statut', key: 'statut', width: 15, type: 'string' },
    ];
  }

  /**
   * Récupérer les données pour l'export
   */
  private async getData(filters: ExportCommandesQueryDto): Promise<any[]> {
    const where: any = {};

    if (filters.statut) {
      where.statut = filters.statut;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.dateDebut || filters.dateFin) {
      where.dateCommande = {};
      if (filters.dateDebut) {
        where.dateCommande.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        where.dateCommande.lte = new Date(filters.dateFin);
      }
    }

    const commandes = await this.prisma.commande.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            email: true,
            telephone: true,
            ville: true,
          },
        },
        createur: {
          select: {
            id: true,
            nomComplet: true,
          },
        },
        lignes: {
          include: {
            produit: {
              select: {
                id: true,
                reference: true,
                nom: true,
              },
            },
          },
        },
      },
      orderBy: { dateCommande: 'desc' },
    });

    // Transformer les données pour l'export
    return commandes.map((c) => ({
      ...c,
      nombreArticles: c.lignes.reduce((sum, l) => sum + l.quantite, 0),
      statutLabel: this.getStatutLabel(c.statut),
    }));
  }

  /**
   * Obtenir le libellé du statut
   */
  private getStatutLabel(statut: string): string {
    const labels: Record<string, string> = {
      EN_ATTENTE: '⏳ En attente',
      EN_TRAITEMENT: '🔄 En traitement',
      EXPEDIE: '📦 Expédié',
      LIVRE: '✅ Livré',
      ANNULE: '❌ Annulé',
    };
    return labels[statut] || statut;
  }

  /**
   * Calculer les statistiques pour le sous-titre
   */
  private getStatistiques(data: any[]): string {
    const total = data.length;
    const montantTotal = data.reduce((sum, c) => sum + Number(c.montantTotal || 0), 0);
    const livrees = data.filter((c) => c.statut === 'LIVRE').length;
    const enCours = data.filter((c) => ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE'].includes(c.statut)).length;

    return `${total} commandes | ${livrees} livrées | ${enCours} en cours | CA: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(montantTotal)}`;
  }

  /**
   * Exporter les commandes
   */
  async export(
    filters: ExportCommandesQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const data = await this.getData(filters);
    const subtitle = this.getStatistiques(data);

    // Construire le titre avec la période si spécifiée
    let title = 'Liste des Commandes';
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
        filename: `commandes_${new Date().toISOString().split('T')[0]}`,
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
   * Exporter les commandes avec détail des lignes
   */
  async exportDetaille(
    filters: ExportCommandesQueryDto,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const commandes = await this.getData(filters);

    // Aplatir les données (une ligne par produit commandé)
    const dataDetaille: any[] = [];
    
    for (const commande of commandes) {
      for (const ligne of commande.lignes) {
        dataDetaille.push({
          numeroCommande: commande.numeroCommande,
          dateCommande: commande.dateCommande,
          client: commande.client,
          produit: ligne.produit,
          quantite: ligne.quantite,
          prixUnitaire: ligne.prixUnitaire,
          sousTotal: Number(ligne.quantite) * Number(ligne.prixUnitaire),
          statut: this.getStatutLabel(commande.statut),
        });
      }
    }

    await this.exportService.export(
      {
        filename: `commandes_detail_${new Date().toISOString().split('T')[0]}`,
        title: 'Détail des Commandes',
        subtitle: `${dataDetaille.length} lignes de commande`,
        columns: this.getColumnsDetaillees(),
        data: dataDetaille,
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