import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto';
import { UpdateFournisseurDto } from './dto/update-fournisseur.dto';

@Injectable()
export class FournisseursService {
  constructor(private prisma: PrismaService) {}

  async create(createFournisseurDto: CreateFournisseurDto) {
    await this.checkExisting(createFournisseurDto.nom, createFournisseurDto.email);

    return this.prisma.fournisseur.create({
      data: createFournisseurDto,
    });
  }

  async findAll(filters?: { estActif?: boolean; search?: string }) {
    const where: any = {};

    if (filters?.estActif !== undefined) {
      where.estActif = filters.estActif;
    }

    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { telephone: { contains: filters.search, mode: 'insensitive' } },
        { personneContact: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.fournisseur.findMany({
      where,
      include: {
        _count: {
          select: {
            produitsFournisseurs: true,
            bonsCommande: true,
          },
        },
      },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: number) {
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id },
      include: {
        produitsFournisseurs: {
          take: 10,
          include: {
            produit: {
              select: {
                id: true,
                nom: true,
                reference: true,
                quantiteStock: true, // ✅ C'est bien quantiteStock dans votre schéma
                prixVente: true,
                categorie: {
                  select: {
                    id: true,
                    nom: true,
                  },
                },
              },
            },
          },
          orderBy: {
            produit: {
              nom: 'asc',
            },
          },
        },
        bonsCommande: {
          take: 5,
          orderBy: {
            dateCreation: 'desc',
          },
          select: {
            id: true,
            numeroCommande: true,
            dateCommande: true,
            statut: true,
            montantTotal: true,
          },
        },
        _count: {
          select: {
            produitsFournisseurs: true,
            bonsCommande: true,
          },
        },
      },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${id} non trouvé`);
    }

    return fournisseur;
  }

  async update(id: number, updateFournisseurDto: UpdateFournisseurDto) {
    await this.findOne(id);

    if (updateFournisseurDto.nom || updateFournisseurDto.email) {
      await this.checkExisting(
        updateFournisseurDto.nom,
        updateFournisseurDto.email,
        id,
      );
    }

    return this.prisma.fournisseur.update({
      where: { id },
      data: updateFournisseurDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Vérifier s'il y a des produits associés via la table intermédiaire
    const produitsCount = await this.prisma.produitFournisseur.count({
      where: { fournisseurId: id },
    });

    if (produitsCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer ce fournisseur car il a ${produitsCount} produit(s) associé(s)`,
      );
    }

    // Vérifier s'il y a des bons de commande
    const bonsCommandeCount = await this.prisma.bonCommandeAchat.count({
      where: { fournisseurId: id },
    });

    if (bonsCommandeCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer ce fournisseur car il a ${bonsCommandeCount} bon(s) de commande`,
      );
    }

    return this.prisma.fournisseur.delete({ where: { id } });
  }

  /**
   * Vérifie si un fournisseur avec ce nom ou email existe déjà
   */
  async checkExisting(
    nom?: string,
    email?: string,
    excludeId?: number,
  ): Promise<void> {
    const conditions: any[] = [];

    if (nom) {
      conditions.push({
        nom: {
          equals: nom,
          mode: 'insensitive',
        },
      });
    }

    if (email) {
      conditions.push({
        email: {
          equals: email,
          mode: 'insensitive',
        },
      });
    }

    if (conditions.length === 0) {
      return;
    }

    const whereCondition: any = {
      OR: conditions,
    };

    if (excludeId) {
      whereCondition.id = {
        not: excludeId,
      };
    }

    const existingFournisseur = await this.prisma.fournisseur.findFirst({
      where: whereCondition,
      select: { id: true, nom: true, email: true },
    });

    if (existingFournisseur) {
      const duplicateFields: string[] = [];

      if (nom && existingFournisseur.nom.toLowerCase() === nom.toLowerCase()) {
        duplicateFields.push('nom');
      }

      if (email && existingFournisseur.email?.toLowerCase() === email.toLowerCase()) {
        duplicateFields.push('email');
      }

      const fieldNames = duplicateFields.join(' et ');
      throw new ConflictException(
        `Un fournisseur avec ${fieldNames === 'nom et email' ? 'ce nom et cet email' : fieldNames === 'nom' ? 'ce nom' : 'cet email'} existe déjà`,
      );
    }
  }

  /**
   * Obtenir les statistiques des fournisseurs
   */
  async getStatistiques() {
    const [
      totalFournisseurs,
      fournisseursActifs,
      fournisseursInactifs,
      fournisseursAvecProduits,
    ] = await Promise.all([
      this.prisma.fournisseur.count(),
      this.prisma.fournisseur.count({
        where: { estActif: true },
      }),
      this.prisma.fournisseur.count({
        where: { estActif: false },
      }),
      this.prisma.fournisseur.count({
        where: {
          produitsFournisseurs: {
            some: {},
          },
        },
      }),
    ]);

    return {
      totalFournisseurs,
      fournisseursActifs,
      fournisseursInactifs,
      fournisseursAvecProduits,
      fournisseursSansProduits: totalFournisseurs - fournisseursAvecProduits,
    };
  }

  /**
   * Obtenir les produits d'un fournisseur avec leurs conditions
   */
  async getProduits(fournisseurId: number) {
    const fournisseur = await this.findOne(fournisseurId);

    const produitsFournisseurs = await this.prisma.produitFournisseur.findMany({
      where: { fournisseurId },
      include: {
        produit: {
          include: {
            categorie: {
              select: {
                id: true,
                nom: true,
              },
            },
          },
        },
      },
      orderBy: {
        produit: {
          nom: 'asc',
        },
      },
    });

    return {
      fournisseur: {
        id: fournisseur.id,
        nom: fournisseur.nom,
        personneContact: fournisseur.personneContact,
        email: fournisseur.email,
        telephone: fournisseur.telephone,
      },
      produits: produitsFournisseurs.map((pf) => ({
        // Informations du produit
        id: pf.produit.id,
        nom: pf.produit.nom,
        reference: pf.produit.reference,
        description: pf.produit.description,
        quantiteStock: pf.produit.quantiteStock,
        prixVente: pf.produit.prixVente,
        categorie: pf.produit.categorie,
        
        // Informations de la relation fournisseur-produit (depuis votre schéma)
        referenceFournisseur: pf.referenceFournisseur,
        delaiLivraisonJours: pf.delaiLivraisonJours,
        quantiteMinimumCommande: pf.quantiteMinimumCommande,
        prixUnitaire: pf.prixUnitaire, // C'est bien prixUnitaire dans votre schéma
        estPrefere: pf.estPrefere,
      })),
    };
  }
}