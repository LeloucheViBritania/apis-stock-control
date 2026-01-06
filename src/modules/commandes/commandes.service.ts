import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import type { Response } from 'express';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class CommandesService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway
  ) {}

  async create(createCommandeDto: CreateCommandeDto, userId: number) {
    const count = await this.prisma.commande.count();
    const numeroCommande = `CMD-${String(count + 1).padStart(6, '0')}`;
    const { entrepotId } = createCommandeDto;
    
    // Utiliser lignes comme alias pour details
    const details = createCommandeDto.details || createCommandeDto.lignes || [];
    
    // Utiliser dateLivraisonPrevue comme alias pour dateLivraison
    const dateLivraison = createCommandeDto.dateLivraison || createCommandeDto.dateLivraisonPrevue;

    if (!details || details.length === 0) {
      throw new BadRequestException('Au moins un produit est requis');
    }

    // Pré-vérification du stock
    for (const detail of details) {
      const produit = await this.prisma.produit.findUnique({
        where: { id: detail.produitId },
      });

      if (!produit) {
        throw new NotFoundException(`Produit #${detail.produitId} non trouvé`);
      }

      if (entrepotId) {
        const inventaire = await this.prisma.inventaire.findUnique({
          where: {
            unique_produit_entrepot: {
              produitId: detail.produitId,
              entrepotId: entrepotId
            }
          }
        });

        if (!inventaire) {
          throw new BadRequestException(`Produit ${produit.nom} non référencé dans l'entrepôt #${entrepotId}`);
        }

        const disponible = inventaire.quantite - inventaire.quantiteReservee;
        if (disponible < detail.quantite) {
          throw new BadRequestException(
            `Stock insuffisant à l'entrepôt pour ${produit.nom}. Disponible: ${disponible}`
          );
        }
      } else {
        if (produit.quantiteStock < detail.quantite) {
          throw new BadRequestException(
            `Stock insuffisant pour ${produit.nom}. Disponible: ${produit.quantiteStock}`,
          );
        }
      }
    }

    // Calculer le montant total
    let montantTotal = 0;
    const detailsAvecPrix = await Promise.all(
      details.map(async (detail) => {
        const produit = await this.prisma.produit.findUnique({
          where: { id: detail.produitId },
        });
        const prix = detail.prixUnitaire || Number(produit?.prixVente || 0);
        montantTotal += prix * detail.quantite;
        return { ...detail, prixUnitaire: prix };
      }),
    );

    // Transaction de création
    return this.prisma.$transaction(async (tx) => {
      const commande = await tx.commande.create({
        data: {
          numeroCommande,
          clientId: createCommandeDto.clientId,
          entrepotId: entrepotId || null,
          dateCommande: createCommandeDto.dateCommande ? new Date(createCommandeDto.dateCommande) : new Date(),
          dateLivraison: dateLivraison
            ? new Date(dateLivraison)
            : null,
          montantTotal: montantTotal - (createCommandeDto.remise || 0),
          creePar: userId,
          lignes: {
            create: detailsAvecPrix.map((d) => ({
              produitId: d.produitId,
              quantite: d.quantite,
              prixUnitaire: d.prixUnitaire,
            })),
          },
        },
        include: {
          client: true,
          lignes: { include: { produit: true } },
        },
      });

      // Décrémenter le stock
      for (const detail of detailsAvecPrix) {
        let stockRestantPourAlerte = 0;
        let produitNom = '';
        let niveauMin = 0;

        if (entrepotId) {
          const updateResult = await tx.inventaire.updateMany({
            where: {
              produitId: detail.produitId,
              entrepotId: entrepotId,
              quantite: { gte: detail.quantite }
            },
            data: { quantite: { decrement: detail.quantite } }
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(`Conflit de stock (Premium) sur le produit ID ${detail.produitId}`);
          }

          const invAjour = await tx.inventaire.findUnique({
            where: { unique_produit_entrepot: { produitId: detail.produitId, entrepotId } },
            include: { produit: true }
          });

          if (!invAjour) {
            throw new BadRequestException(`Erreur critique : Inventaire introuvable après mise à jour (ID ${detail.produitId})`);
          }

          stockRestantPourAlerte = invAjour.quantite;
          produitNom = invAjour.produit.nom;
          niveauMin = invAjour.produit.niveauStockMin;
        } else {
          const updateResult = await tx.produit.updateMany({
            where: { 
              id: detail.produitId,
              quantiteStock: { gte: detail.quantite }
            },
            data: { quantiteStock: { decrement: detail.quantite } },
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(`Conflit de stock (Free) sur le produit ID ${detail.produitId}`);
          }

          const prodAjour = await tx.produit.findUnique({
            where: { id: detail.produitId } 
          });

          if (!prodAjour) {
            throw new BadRequestException(`Erreur critique : Produit introuvable après mise à jour (ID ${detail.produitId})`);
          }

          stockRestantPourAlerte = prodAjour.quantiteStock;
          produitNom = prodAjour.nom;
          niveauMin = prodAjour.niveauStockMin;
        }

        // Gestion des alertes
        if (stockRestantPourAlerte <= niveauMin) {
          this.notificationsGateway.sendStockAlert({
            produit: produitNom,
            stockRestant: stockRestantPourAlerte,
            message: `ALERTE STOCK : ${produitNom} est bas (${stockRestantPourAlerte}) ${entrepotId ? 'dans entrepot #' + entrepotId : '(Global)'}`
          });
        }

        // Créer le mouvement de stock
        await tx.mouvementStock.create({
          data: {
            produitId: detail.produitId,
            entrepotId: entrepotId || null,
            typeMouvement: 'SORTIE',
            quantite: detail.quantite,
            raison: `Commande ${numeroCommande}`,
            typeReference: 'commande',
            referenceId: commande.id,
            effectuePar: userId,
          },
        });
      }

      return commande;
    });
  }

  async findAll(filters?: {
    search?: string;
    statut?: string;
    clientId?: number;
    entrepotId?: number;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (filters?.search) {
      where.OR = [
        { numeroCommande: { contains: filters.search, mode: 'insensitive' } },
        { client: { nom: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCommande = {};
      if (filters.dateDebut) where.dateCommande.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateCommande.lte = new Date(filters.dateFin);
    }

    const [commandes, total] = await Promise.all([
      this.prisma.commande.findMany({
        where,
        include: {
          client: true,
          entrepot: true,
          lignes: { include: { produit: true } },
        },
        orderBy: { dateCommande: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commande.count({ where }),
    ]);

    return {
      data: commandes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const commande = await this.prisma.commande.findUnique({
      where: { id },
      include: {
        client: true,
        entrepot: true,
        createur: { select: { id: true, nomComplet: true } },
        lignes: {
          include: {
            produit: { include: { categorie: true } },
          },
        },
      },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${id} non trouvée`);
    }
    return commande;
  }

  async update(id: number, updateCommandeDto: any) {
    const commande = await this.findOne(id);

    if (commande.statut === 'LIVRE') {
      throw new BadRequestException('Impossible de modifier une commande déjà livrée');
    }
    if (commande.statut === 'ANNULE') {
      throw new BadRequestException('Impossible de modifier une commande annulée');
    }

    return this.prisma.commande.update({
      where: { id },
      data: updateCommandeDto,
      include: {
        client: true,
        lignes: { include: { produit: true } },
      },
    });
  }

  async remove(id: number) {
    const commande = await this.findOne(id);
    
    if (commande.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Seules les commandes en attente peuvent être supprimées');
    }

    await this.prisma.ligneCommande.deleteMany({ where: { commandeId: id } });
    return this.prisma.commande.delete({ where: { id } });
  }

  async getStatistiques(filters?: { dateDebut?: string; dateFin?: string }) {
    const where: any = {};
    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCommande = {};
      if (filters.dateDebut) where.dateCommande.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateCommande.lte = new Date(filters.dateFin);
    }

    const [total, enCours, completees, annulees, montantResult] = await Promise.all([
      this.prisma.commande.count({ where }),
      this.prisma.commande.count({
        where: { ...where, statut: { in: ['EN_ATTENTE', 'EN_TRAITEMENT', 'EN_TRAITEMENT', 'EXPEDIE'] } },
      }),
      this.prisma.commande.count({ where: { ...where, statut: 'LIVRE' } }),
      this.prisma.commande.count({ where: { ...where, statut: 'ANNULE' } }),
      this.prisma.commande.aggregate({
        _sum: { montantTotal: true },
        where: { ...where, statut: 'LIVRE' },
      }),
    ]);

    return {
      total,
      enCours,
      completees,
      annulees,
      montantTotal: Number(montantResult._sum.montantTotal || 0),
    };
  }

  async getParStatut() {
    const statuts = ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE', 'FACTUREE'];
    const counts = await Promise.all(
      statuts.map(async (statut) => ({
        statut,
        count: await this.prisma.commande.count({ where: { statut: statut as any } }),
      }))
    );
    return counts;
  }

  // ==========================================
  // GESTION DES STATUTS
  // ==========================================

  async changeStatut(id: number, statut: string, notes?: string, userId?: number) {
    const commande = await this.findOne(id);
    
    const transitions: Record<string, string[]> = {
      'EN_ATTENTE': ['EN_TRAITEMENT', 'ANNULE'],
      'EN_TRAITEMENT': ['EXPEDIE', 'ANNULE'],
      'EXPEDIE': ['LIVRE'],
      'LIVRE': [],
      'ANNULE': [],
    };

    if (!transitions[commande.statut]?.includes(statut)) {
      throw new BadRequestException(
        `Transition invalide de ${commande.statut} vers ${statut}`
      );
    }

    return this.prisma.commande.update({
      where: { id },
      data: { 
        statut: statut as any,
      },
      include: { client: true, lignes: { include: { produit: true } } },
    });
  }

  async valider(id: number, userId?: number) {
    return this.changeStatut(id, 'EN_TRAITEMENT', undefined, userId);
  }

  async expedier(id: number, data?: { transporteur?: string; numeroSuivi?: string; notes?: string }, userId?: number) {
    const commande = await this.findOne(id);
    
    if (!['EN_TRAITEMENT'].includes(commande.statut)) {
      throw new BadRequestException('La commande doit être validée pour être expédiée');
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: 'EXPEDIE',
      },
      include: { client: true, lignes: { include: { produit: true } } },
    });
  }

  async livrer(id: number, userId?: number) {
    const commande = await this.findOne(id);
    
    if (commande.statut !== 'EXPEDIE') {
      throw new BadRequestException('La commande doit être expédiée avant d\'être livrée');
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: 'LIVRE',
        dateLivraison: new Date(),
      },
      include: { client: true, lignes: { include: { produit: true } } },
    });
  }

  async annuler(id: number, raison?: string, userId?: number) {
    const commande = await this.findOne(id);

    if (['LIVRE', 'ANNULE'].includes(commande.statut)) {
      throw new BadRequestException(`Impossible d'annuler une commande ${commande.statut.toLowerCase()}`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const ligne of commande.lignes) {
        if (commande.entrepotId) {
          await tx.inventaire.upsert({
            where: { unique_produit_entrepot: { produitId: ligne.produitId, entrepotId: commande.entrepotId }},
            update: { quantite: { increment: ligne.quantite } },
            create: { 
              produitId: ligne.produitId, 
              entrepotId: commande.entrepotId, 
              quantite: ligne.quantite 
            }
          });
        } else {
          await tx.produit.update({
            where: { id: ligne.produitId },
            data: { quantiteStock: { increment: ligne.quantite } },
          });
        }

        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            entrepotId: commande.entrepotId || null,
            typeMouvement: 'RETOUR',
            quantite: ligne.quantite,
            raison: `Annulation commande ${commande.numeroCommande}${raison ? ` - ${raison}` : ''}`,
            typeReference: 'commande',
            referenceId: commande.id,
            effectuePar: userId,
          },
        });
      }

      return tx.commande.update({
        where: { id },
        data: { 
          statut: 'ANNULE',
        },
        include: { lignes: true }
      });
    });
  }

  async cancel(id: number, userId: number) {
    return this.annuler(id, undefined, userId);
  }

  // ==========================================
  // GESTION DES LIGNES
  // ==========================================

  async ajouterLigne(id: number, ligne: { produitId: number; quantite: number; prixUnitaire?: number; remise?: number }) {
    const commande = await this.findOne(id);
    
    if (commande.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible d\'ajouter des lignes à une commande déjà traitée');
    }

    const produit = await this.prisma.produit.findUnique({ where: { id: ligne.produitId } });
    if (!produit) {
      throw new NotFoundException(`Produit #${ligne.produitId} non trouvé`);
    }

    const prixUnitaire = ligne.prixUnitaire || Number(produit.prixVente);
    const remise = ligne.remise || 0;

    const nouvelleLigne = await this.prisma.ligneCommande.create({
      data: {
        commandeId: id,
        produitId: ligne.produitId,
        quantite: ligne.quantite,
        prixUnitaire,
      },
      include: { produit: true },
    });

    await this.recalculerMontant(id);
    return nouvelleLigne;
  }

  async modifierLigne(commandeId: number, ligneId: number, data: { quantite?: number; prixUnitaire?: number; remise?: number }) {
    const commande = await this.findOne(commandeId);
    
    if (commande.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible de modifier les lignes d\'une commande déjà traitée');
    }

    const ligne = await this.prisma.ligneCommande.findFirst({
      where: { id: ligneId, commandeId },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne #${ligneId} non trouvée`);
    }

    const updated = await this.prisma.ligneCommande.update({
      where: { id: ligneId },
      data,
      include: { produit: true },
    });

    await this.recalculerMontant(commandeId);
    return updated;
  }

  async supprimerLigne(commandeId: number, ligneId: number) {
    const commande = await this.findOne(commandeId);
    
    if (commande.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible de supprimer des lignes d\'une commande déjà traitée');
    }

    const ligne = await this.prisma.ligneCommande.findFirst({
      where: { id: ligneId, commandeId },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne #${ligneId} non trouvée`);
    }

    await this.prisma.ligneCommande.delete({ where: { id: ligneId } });
    await this.recalculerMontant(commandeId);
    
    return { message: 'Ligne supprimée' };
  }

  private async recalculerMontant(commandeId: number) {
    const lignes = await this.prisma.ligneCommande.findMany({
      where: { commandeId },
    });

    const montantTotal = lignes.reduce((acc, ligne) => {
      const sousTotal = Number(ligne.prixUnitaire) * ligne.quantite;
      return acc + sousTotal;
    }, 0);

    await this.prisma.commande.update({
      where: { id: commandeId },
      data: { montantTotal },
    });
  }

  // ==========================================
  // DOCUMENTS PDF
  // ==========================================

  async genererFacture(id: number, res: Response) {
    const commande = await this.findOne(id);
    
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture-${commande.numeroCommande}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text('FACTURE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`N° ${commande.numeroCommande}`, { align: 'right' });
    doc.text(`Date: ${new Date(commande.dateCommande).toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(14).text('Client:', { underline: true });
    doc.fontSize(12).text(commande.client?.nom || 'N/A');
    doc.text(commande.client?.email || '');
    doc.text(commande.client?.telephone || '');
    doc.text(commande.client?.adresse || '');
    doc.moveDown();

    doc.fontSize(14).text('Détails de la commande:', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Produit', 50, tableTop);
    doc.text('Qté', 280, tableTop);
    doc.text('Prix Unit.', 340, tableTop);
    doc.text('Total', 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let yPos = tableTop + 25;
    for (const ligne of commande.lignes) {
      const total = Number(ligne.prixUnitaire) * ligne.quantite;
      doc.text(ligne.produit.nom, 50, yPos, { width: 220 });
      doc.text(String(ligne.quantite), 280, yPos);
      doc.text(`${Number(ligne.prixUnitaire).toFixed(2)} €`, 340, yPos);
      doc.text(`${total.toFixed(2)} €`, 450, yPos);
      yPos += 20;
    }

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    doc.fontSize(14).text(`TOTAL: ${Number(commande.montantTotal).toFixed(2)} €`, 350, yPos, { align: 'right' });

    doc.end();
  }

  async genererBonLivraison(id: number, res: Response) {
    const commande = await this.findOne(id);
    
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bon-livraison-${commande.numeroCommande}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).text('BON DE LIVRAISON', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`N° ${commande.numeroCommande}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(14).text('Destinataire:', { underline: true });
    doc.fontSize(12).text(commande.client?.nom || 'N/A');
    doc.text(commande.client?.adresse || '');
    doc.text(`Tél: ${commande.client?.telephone || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Contenu:', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Référence', 50, tableTop);
    doc.text('Désignation', 150, tableTop);
    doc.text('Quantité', 450, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let yPos = tableTop + 25;
    for (const ligne of commande.lignes) {
      doc.text(ligne.produit.reference || '-', 50, yPos);
      doc.text(ligne.produit.nom, 150, yPos, { width: 280 });
      doc.text(String(ligne.quantite), 450, yPos);
      yPos += 20;
    }

    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    doc.moveDown(2);

    doc.fontSize(10);
    doc.text('Signature du destinataire:', 50, doc.y);
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke();

    doc.end();
  }
}
