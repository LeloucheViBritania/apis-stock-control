import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProduitDto } from './dto/create-produit.dto';
import { UpdateProduitDto } from './dto/update-produit.dto';
import { AjusterStockDto } from './dto/ajuster-stock.dto';

@Injectable()
export class ProduitsService {
  constructor(private prisma: PrismaService) {}

  async create(createProduitDto: CreateProduitDto) {
    // Vérifier si la référence existe déjà
    const existingProduct = await this.prisma.produit.findUnique({
      where: { reference: createProduitDto.reference },
    });

    if (existingProduct) {
      throw new BadRequestException('Cette référence produit existe déjà');
    }

    return this.prisma.produit.create({
      data: createProduitDto,
      include: {
        categorie: true,
      },
    });
  }

  async findAll(filters?: {
    categorieId?: number;
    estActif?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.categorieId) {
      where.categorieId = filters.categorieId;
    }

    if (filters?.estActif !== undefined) {
      where.estActif = filters.estActif;
    }else{
      where.estActif = true;
    }

    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { marque: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [produits, total] = await Promise.all([
      this.prisma.produit.findMany({
        where,
        include: {
          categorie: true,
          _count: {
            select: {
              produitsFournisseurs: true,
            },
          },
        },
        orderBy: { nom: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.produit.count({ where }),
    ]);

    return {
      data: produits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const produit = await this.prisma.produit.findUnique({
      where: { id },
      include: {
        categorie: true,
        produitsFournisseurs: {
          include: {
            fournisseur: {
              select: {
                id: true,
                nom: true,
                personneContact: true,
                email: true,
                telephone: true,
                estActif: true,
              },
            },
          },
          orderBy: [
            { estPrefere: 'desc' },
            { prixUnitaire: 'asc' },
          ],
        },
        mouvementsStock: {
          orderBy: { dateMouvement: 'desc' },
          take: 10,
          include: {
            utilisateur: {
              select: {
                id: true,
                nomComplet: true,
              },
            },
          },
        },
        lignesCommande: {
          take: 5,
          orderBy: { id: 'desc' },
          include: {
            commande: {
              select: {
                numeroCommande: true,
                dateCommande: true,
                statut: true,
              },
            },
          },
        },
        _count: {
          select: {
            produitsFournisseurs: true,
          },
        },
      },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${id} non trouvé`);
    }

    return produit;
  }

  async update(id: number, updateProduitDto: UpdateProduitDto) {
    await this.findOne(id); // Vérifier l'existence

    // Si on change la référence, vérifier qu'elle n'existe pas déjà
    if (updateProduitDto.reference) {
      const existingProduct = await this.prisma.produit.findFirst({
        where: {
          reference: updateProduitDto.reference,
          NOT: { id },
        },
      });

      if (existingProduct) {
        throw new BadRequestException('Cette référence produit existe déjà');
      }
    }

    return this.prisma.produit.update({
      where: { id },
      data: updateProduitDto,
      include: {
        categorie: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.produit.update({
      where: { id },
      data: {estActif: false}
    });
  }

  // ==========================================
  // GESTION DES FOURNISSEURS
  // ==========================================

  /**
   * Obtenir tous les fournisseurs d'un produit
   */
  async getFournisseurs(produitId: number) {
    await this.findOne(produitId);

    const fournisseurs = await this.prisma.produitFournisseur.findMany({
      where: { produitId },
      include: {
        fournisseur: {
          select: {
            id: true,
            nom: true,
            personneContact: true,
            email: true,
            telephone: true,
            adresse: true,
            ville: true,
            pays: true,
            estActif: true,
            conditionsPaiement: true,
          },
        },
      },
      orderBy: [
        { estPrefere: 'desc' },
        { prixUnitaire: 'asc' },
      ],
    });

    return fournisseurs.map(pf => ({
      fournisseur: pf.fournisseur,
      referenceFournisseur: pf.referenceFournisseur,
      prixUnitaire: pf.prixUnitaire,
      delaiLivraisonJours: pf.delaiLivraisonJours,
      quantiteMinimumCommande: pf.quantiteMinimumCommande,
      estPrefere: pf.estPrefere,
      dateCreation: pf.dateCreation,
    }));
  }

  /**
   * Ajouter un fournisseur à un produit
   */
  async ajouterFournisseur(
    produitId: number,
    fournisseurId: number,
    data: {
      referenceFournisseur?: string;
      prixUnitaire?: number;
      delaiLivraisonJours?: number;
      quantiteMinimumCommande?: number;
      estPrefere?: boolean;
    }
  ) {
    // Vérifier que le produit existe
    await this.findOne(produitId);

    // Vérifier que le fournisseur existe et est actif
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    if (!fournisseur.estActif) {
      throw new BadRequestException('Ce fournisseur est inactif');
    }

    // Vérifier si la relation existe déjà
    const existing = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        fournisseurId,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ce fournisseur est déjà associé à ce produit'
      );
    }

    // Si estPrefere = true, mettre tous les autres fournisseurs à false
    if (data.estPrefere) {
      await this.prisma.produitFournisseur.updateMany({
        where: { produitId },
        data: { estPrefere: false },
      });
    }

    // Créer la relation
    return this.prisma.produitFournisseur.create({
      data: {
        produitId,
        fournisseurId,
        referenceFournisseur: data.referenceFournisseur,
        prixUnitaire: data.prixUnitaire,
        delaiLivraisonJours: data.delaiLivraisonJours,
        quantiteMinimumCommande: data.quantiteMinimumCommande || 1,
        estPrefere: data.estPrefere || false,
      },
      include: {
        fournisseur: {
          select: {
            id: true,
            nom: true,
            personneContact: true,
            email: true,
            telephone: true,
            estActif: true,
          },
        },
        produit: {
          select: {
            id: true,
            nom: true,
            reference: true,
          },
        },
      },
    });
  }

  /**
   * Modifier la relation produit-fournisseur
   */
  async modifierFournisseur(
    produitId: number,
    fournisseurId: number,
    data: {
      referenceFournisseur?: string;
      prixUnitaire?: number;
      delaiLivraisonJours?: number;
      quantiteMinimumCommande?: number;
      estPrefere?: boolean;
    }
  ) {
    // Vérifier que la relation existe
    const relation = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        fournisseurId,
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `Aucune relation trouvée entre le produit #${produitId} et le fournisseur #${fournisseurId}`
      );
    }

    // Si estPrefere = true, mettre tous les autres à false
    if (data.estPrefere) {
      await this.prisma.produitFournisseur.updateMany({
        where: { 
          produitId,
          NOT: { fournisseurId }
        },
        data: { estPrefere: false },
      });
    }

    // Mettre à jour la relation - utiliser l'ID unique
    return this.prisma.produitFournisseur.update({
      where: {
        id: relation.id,
      },
      data,
      include: {
        fournisseur: {
          select: {
            id: true,
            nom: true,
            personneContact: true,
            email: true,
            telephone: true,
            estActif: true,
          },
        },
      },
    });
  }

  /**
   * Retirer un fournisseur d'un produit
   */
  async retirerFournisseur(produitId: number, fournisseurId: number) {
    // Vérifier que la relation existe
    const relation = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        fournisseurId,
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `Aucune relation trouvée entre le produit #${produitId} et le fournisseur #${fournisseurId}`
      );
    }

    // Supprimer la relation - utiliser l'ID unique
    await this.prisma.produitFournisseur.delete({
      where: {
        id: relation.id,
      },
    });

    return {
      message: 'Fournisseur retiré avec succès',
      produitId,
      fournisseurId,
    };
  }

  /**
   * Définir un fournisseur comme préféré
   */
  async definirFournisseurPrefere(produitId: number, fournisseurId: number) {
    // Vérifier que la relation existe
    const relation = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        fournisseurId,
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `Aucune relation trouvée entre le produit #${produitId} et le fournisseur #${fournisseurId}`
      );
    }

    // Mettre tous les fournisseurs à non-préféré
    await this.prisma.produitFournisseur.updateMany({
      where: { produitId },
      data: { estPrefere: false },
    });

    // Définir celui-ci comme préféré - utiliser l'ID unique
    return this.prisma.produitFournisseur.update({
      where: {
        id: relation.id,
      },
      data: { estPrefere: true },
      include: {
        fournisseur: true,
      },
    });
  }

  /**
   * Obtenir le fournisseur préféré d'un produit
   */
  async getFournisseurPrefere(produitId: number) {
    await this.findOne(produitId);

    const fournisseurPrefere = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        estPrefere: true,
      },
      include: {
        fournisseur: true,
      },
    });

    if (!fournisseurPrefere) {
      return null;
    }

    return {
      fournisseur: fournisseurPrefere.fournisseur,
      referenceFournisseur: fournisseurPrefere.referenceFournisseur,
      prixUnitaire: fournisseurPrefere.prixUnitaire,
      delaiLivraisonJours: fournisseurPrefere.delaiLivraisonJours,
      quantiteMinimumCommande: fournisseurPrefere.quantiteMinimumCommande,
    };
  }

  /**
   * Obtenir le meilleur prix parmi tous les fournisseurs
   */
  async getMeilleurPrix(produitId: number) {
    await this.findOne(produitId);

    const meilleurPrix = await this.prisma.produitFournisseur.findFirst({
      where: {
        produitId,
        prixUnitaire: { not: null },
        fournisseur: { estActif: true },
      },
      orderBy: {
        prixUnitaire: 'asc',
      },
      include: {
        fournisseur: {
          select: {
            id: true,
            nom: true,
            personneContact: true,
            email: true,
            telephone: true,
          },
        },
      },
    });

    if (!meilleurPrix) {
      return null;
    }

    return {
      fournisseur: meilleurPrix.fournisseur,
      prixUnitaire: meilleurPrix.prixUnitaire,
      referenceFournisseur: meilleurPrix.referenceFournisseur,
      delaiLivraisonJours: meilleurPrix.delaiLivraisonJours,
    };
  }

  // ==========================================
  // FONCTIONNALITÉS EXISTANTES
  // ==========================================

  async getStockFaible() {
    return this.prisma.produit.findMany({
      where: {
        quantiteStock: {
          lte: this.prisma.produit.fields.niveauStockMin,
        },
        estActif: true,
      },
      include: {
        categorie: true,
        _count: {
          select: {
            produitsFournisseurs: true,
          },
        },
      },
      orderBy: {
        quantiteStock: 'asc',
      },
    });
  }

  async ajusterStock(
    id: number,
    ajusterStockDto: AjusterStockDto,
    userId: number,
  ) {
    const produit = await this.findOne(id);

    const nouvelleQuantite =
      ajusterStockDto.type === 'entree'
        ? produit.quantiteStock + ajusterStockDto.quantite
        : Math.max(0, produit.quantiteStock - ajusterStockDto.quantite);

    // Créer un mouvement de stock
    await this.prisma.mouvementStock.create({
      data: {
        produitId: id,
        typeMouvement: ajusterStockDto.type.toUpperCase() as any,
        quantite: ajusterStockDto.quantite,
        raison: ajusterStockDto.raison,
        notes: ajusterStockDto.notes,
        effectuePar: userId,
      },
    });

    // Mettre à jour le stock
    return this.prisma.produit.update({
      where: { id },
      data: {
        quantiteStock: nouvelleQuantite,
      },
      include: {
        categorie: true,
      },
    });
  }

  async getStatistiques() {
    const [
      totalProduits,
      produitsActifs,
      stockFaible,
      valeurTotaleStock,
      produitsAvecFournisseurs,
    ] = await Promise.all([
      this.prisma.produit.count(),
      this.prisma.produit.count({ where: { estActif: true } }),
      this.prisma.produit.count({
        where: {
          quantiteStock: {
            lte: this.prisma.produit.fields.niveauStockMin,
          },
        },
      }),
      this.prisma.produit.aggregate({
        _sum: {
          quantiteStock: true,
        },
      }),
      this.prisma.produit.count({
        where: {
          produitsFournisseurs: {
            some: {},
          },
        },
      }),
    ]);

    // Calculer la valeur totale
    const produits = await this.prisma.produit.findMany({
      select: {
        quantiteStock: true,
        coutUnitaire: true,
      },
    });

    const valeurTotale = produits.reduce((sum, p) => {
      return sum + (p.quantiteStock * Number(p.coutUnitaire || 0));
    }, 0);

    return {
      totalProduits,
      produitsActifs,
      produitsInactifs: totalProduits - produitsActifs,
      stockFaible,
      totalArticlesEnStock: valeurTotaleStock._sum.quantiteStock || 0,
      valeurTotaleStock: valeurTotale,
      produitsAvecFournisseurs,
      produitsSansFournisseurs: totalProduits - produitsAvecFournisseurs,
    };
  }

  async getTopProduits(limit: number = 10) {
    return this.prisma.produit.findMany({
      take: limit,
      orderBy: {
        quantiteStock: 'desc',
      },
      include: {
        categorie: true,
        _count: {
          select: {
            produitsFournisseurs: true,
          },
        },
      },
    });
  }

  /**
   * Importer des produits depuis un fichier
   * Note: Cette méthode délègue au ProduitsImportService
   */
  async import(formData: any, userId?: number) {
    // Cette méthode est un placeholder - l'import réel est géré par ProduitsImportService
    // via le controller qui injecte le service d'import directement
    throw new Error('Utilisez ProduitsImportService pour l\'import de fichiers');
  }
}