import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEntrepotDto } from './dto/create-entrepot.dto';
import { UpdateEntrepotDto } from './dto/update-entrepot.dto';

/**
 * Service de gestion des entrepôts
 * 
 * Ce service gère toutes les opérations liées aux entrepôts :
 * - CRUD complet (Create, Read, Update, Delete)
 * - Gestion de l'inventaire par entrepôt
 * - Statistiques par entrepôt
 * 
 * @class EntrepotsService
 * @injectable
 */
@Injectable()
export class EntrepotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau entrepôt
   * 
   * Vérifie l'unicité du code et du nom avant la création.
   * 
   * @param {CreateEntrepotDto} createEntrepotDto - Données du nouvel entrepôt
   * @returns {Promise<Entrepot>} L'entrepôt créé avec son ID
   * @throws {ConflictException} Si un entrepôt avec ce code ou nom existe déjà
   * @throws {NotFoundException} Si le responsable spécifié n'existe pas
   * 
   * @example
   * ```typescript
   * const nouvelEntrepot = await entrepotsService.create({
   *   nom: 'Entrepôt Paris Nord',
   *   code: 'PAR-N',
   *   ville: 'Paris'
   * });
   * ```
   */
  async create(createEntrepotDto: CreateEntrepotDto) {
    // Vérifier si le code et/ou le nom existent déjà
    await this.checkExisting(createEntrepotDto.code, createEntrepotDto.nom);

    // Vérifier que le responsable existe si spécifié
    if (createEntrepotDto.responsableId) {
      const responsable = await this.prisma.utilisateur.findUnique({
        where: { id: createEntrepotDto.responsableId },
      });

      if (!responsable) {
        throw new NotFoundException(
          `Utilisateur #${createEntrepotDto.responsableId} non trouvé`
        );
      }
    }

    return this.prisma.entrepot.create({
      data: createEntrepotDto,
      include: {
        responsable: { 
          select: { 
            id: true, 
            nomComplet: true, 
            email: true 
          } 
        },
      },
    });
  }

  /**
   * Récupérer tous les entrepôts avec filtre optionnel
   * 
   * @param {boolean} [estActif] - Filtrer par statut actif/inactif
   * @returns {Promise<Entrepot[]>} Liste des entrepôts avec leurs compteurs
   * 
   * @example
   * ```typescript
   * // Tous les entrepôts
   * const tous = await entrepotsService.findAll();
   * 
   * // Seulement les actifs
   * const actifs = await entrepotsService.findAll(true);
   * 
   * // Seulement les inactifs
   * const inactifs = await entrepotsService.findAll(false);
   * ```
   */
  async findAll(estActif?: boolean) {
    return this.prisma.entrepot.findMany({
      where: estActif !== undefined ? { estActif } : {},
      include: {
        responsable: { 
          select: { 
            id: true, 
            nomComplet: true,
            email: true,
          } 
        },
        _count: { 
          select: { 
            inventaire: true,
            transfertsSource: true,
            transfertsDestination: true,
            bonsCommande: true,
          } 
        },
      },
      orderBy: { nom: 'asc' },
    });
  }

  /**
   * Récupérer un entrepôt par son ID
   * 
   * Retourne l'entrepôt avec :
   * - Informations du responsable
   * - Les 20 premiers articles en stock
   * - Les compteurs de relations
   * 
   * @param {number} id - ID de l'entrepôt
   * @returns {Promise<Entrepot>} L'entrepôt avec ses relations
   * @throws {NotFoundException} Si l'entrepôt n'existe pas
   * 
   * @example
   * ```typescript
   * const entrepot = await entrepotsService.findOne(1);
   * console.log(entrepot.inventaire); // Articles en stock
   * console.log(entrepot._count.inventaire); // Nombre total d'articles
   * ```
   */
  async findOne(id: number) {
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id },
      include: {
        responsable: { 
          select: { 
            id: true, 
            nomComplet: true, 
            email: true 
          } 
        },
        inventaire: {
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
          where: { quantite: { gt: 0 } },
          take: 20,
          orderBy: {
            produit: {
              nom: 'asc',
            },
          },
        },
        _count: { 
          select: { 
            inventaire: true,
            transfertsSource: true,
            transfertsDestination: true,
            ajustements: true,
            bonsCommande: true,
          } 
        },
      },
    });

    if (!entrepot) {
      throw new NotFoundException(`Entrepôt #${id} non trouvé`);
    }

    return entrepot;
  }

  /**
   * Mettre à jour un entrepôt
   * 
   * Vérifie l'unicité du code et du nom si ces champs sont modifiés.
   * 
   * @param {number} id - ID de l'entrepôt à mettre à jour
   * @param {UpdateEntrepotDto} updateEntrepotDto - Données à mettre à jour
   * @returns {Promise<Entrepot>} L'entrepôt mis à jour
   * @throws {NotFoundException} Si l'entrepôt n'existe pas
   * @throws {ConflictException} Si le nouveau code ou nom existe déjà
   * 
   * @example
   * ```typescript
   * // Changer uniquement la capacité
   * const updated = await entrepotsService.update(1, {
   *   capacite: 10000
   * });
   * 
   * // Désactiver l'entrepôt
   * const deactivated = await entrepotsService.update(1, {
   *   estActif: false
   * });
   * ```
   */
  async update(id: number, updateEntrepotDto: UpdateEntrepotDto) {
    await this.findOne(id);

    // Vérifier l'unicité du code et/ou du nom si modifiés
    if (updateEntrepotDto.code || updateEntrepotDto.nom) {
      await this.checkExisting(
        updateEntrepotDto.code,
        updateEntrepotDto.nom,
        id
      );
    }

    // Vérifier que le nouveau responsable existe si spécifié
    if (updateEntrepotDto.responsableId) {
      const responsable = await this.prisma.utilisateur.findUnique({
        where: { id: updateEntrepotDto.responsableId },
      });

      if (!responsable) {
        throw new NotFoundException(
          `Utilisateur #${updateEntrepotDto.responsableId} non trouvé`
        );
      }
    }

    return this.prisma.entrepot.update({
      where: { id },
      data: updateEntrepotDto,
      include: {
        responsable: { 
          select: { 
            id: true, 
            nomComplet: true,
            email: true,
          } 
        },
      },
    });
  }

  /**
   * Supprimer un entrepôt
   * 
   * La suppression est refusée si l'entrepôt a :
   * - Des articles en inventaire
   * - Des transferts en cours
   * - Des bons de commande
   * 
   * @param {number} id - ID de l'entrepôt à supprimer
   * @returns {Promise<Entrepot>} L'entrepôt supprimé
   * @throws {NotFoundException} Si l'entrepôt n'existe pas
   * @throws {ConflictException} Si l'entrepôt a des relations actives
   * 
   * @example
   * ```typescript
   * try {
   *   await entrepotsService.remove(1);
   *   console.log('Entrepôt supprimé');
   * } catch (error) {
   *   if (error instanceof ConflictException) {
   *     console.log('Impossible de supprimer : entrepôt utilisé');
   *   }
   * }
   * ```
   */
  async remove(id: number) {
    await this.findOne(id);

    // Vérifier s'il y a des articles en inventaire
    const inventaireCount = await this.prisma.inventaire.count({
      where: { 
        entrepotId: id,
        quantite: { gt: 0 },
      },
    });

    if (inventaireCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cet entrepôt car il contient ${inventaireCount} article(s) en stock`
      );
    }

    // Vérifier s'il y a des transferts en cours
    const transfertsCount = await this.prisma.transfertStock.count({
      where: {
        OR: [
          { entrepotSourceId: id },
          { entrepotDestinationId: id },
        ],
        statut: {
          in: ['EN_ATTENTE', 'EN_TRANSIT'],
        },
      },
    });

    if (transfertsCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cet entrepôt car il a ${transfertsCount} transfert(s) en cours`
      );
    }

    return this.prisma.entrepot.update({ 
      where: { id } ,
      data: { estActif: false}
    });
  }

  /**
   * Vérifier l'existence d'un entrepôt avec le même code ou nom
   * 
   * Méthode interne utilisée lors de la création et mise à jour.
   * Vérifie l'unicité du code (obligatoire) et du nom (recommandé).
   * 
   * @private
   * @param {string} [code] - Code à vérifier
   * @param {string} [nom] - Nom à vérifier
   * @param {number} [excludeId] - ID à exclure de la vérification (pour les mises à jour)
   * @returns {Promise<void>}
   * @throws {ConflictException} Si un entrepôt avec ce code ou nom existe déjà
   * 
   * @example
   * ```typescript
   * // Lors d'une création
   * await this.checkExisting('PAR-N', 'Entrepôt Paris Nord');
   * 
   * // Lors d'une mise à jour (exclure l'ID actuel)
   * await this.checkExisting('PAR-N', 'Entrepôt Paris Nord', 1);
   * ```
   */
  private async checkExisting(
    code?: string,
    nom?: string,
    excludeId?: number,
  ): Promise<void> {
    const conditions: any[] = [];

    if (code) {
      conditions.push({
        code: {
          equals: code,
          mode: 'insensitive',
        },
      });
    }

    if (nom) {
      conditions.push({
        nom: {
          equals: nom,
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

    const existingEntrepot = await this.prisma.entrepot.findFirst({
      where: whereCondition,
      select: { id: true, code: true, nom: true },
    });

    if (existingEntrepot) {
      const duplicateFields: string[] = [];

      if (code && existingEntrepot.code.toLowerCase() === code.toLowerCase()) {
        duplicateFields.push('code');
      }

      if (nom && existingEntrepot.nom.toLowerCase() === nom.toLowerCase()) {
        duplicateFields.push('nom');
      }

      const fieldNames = duplicateFields.join(' et ');
      throw new ConflictException(
        `Un entrepôt avec ${fieldNames === 'code et nom' ? 'ce code et ce nom' : fieldNames === 'code' ? 'ce code' : 'ce nom'} existe déjà`,
      );
    }
  }

  /**
   * Obtenir l'inventaire complet d'un entrepôt
   * 
   * Retourne tous les articles en stock dans l'entrepôt avec leurs informations produit.
   * 
   * @param {number} entrepotId - ID de l'entrepôt
   * @returns {Promise<Inventaire[]>} Liste des articles en inventaire
   * @throws {NotFoundException} Si l'entrepôt n'existe pas
   * 
   * @example
   * ```typescript
   * const inventaire = await entrepotsService.getInventaire(1);
   * 
   * inventaire.forEach(item => {
   *   console.log(`${item.produit.nom}: ${item.quantite} en stock`);
   *   console.log(`Emplacement: ${item.emplacement}`);
   *   console.log(`Réservé: ${item.quantiteReservee}`);
   * });
   * ```
   */
  async getInventaire(entrepotId: number) {
    await this.findOne(entrepotId);

    return this.prisma.inventaire.findMany({
      where: { entrepotId },
      include: {
        produit: { 
          include: { 
            categorie: {
              select: {
                id: true,
                nom: true,
              },
            },
          } 
        },
      },
      orderBy: { 
        produit: { 
          nom: 'asc' 
        } 
      },
    });
  }

  /**
   * Obtenir les statistiques d'un entrepôt
   * 
   * Retourne :
   * - Nombre de produits différents
   * - Nombre total d'articles
   * - Valeur totale du stock
   * - Nombre de produits en stock faible
   * - Taux de remplissage (si capacité définie)
   * 
   * @param {number} entrepotId - ID de l'entrepôt
   * @returns {Promise<EntrepotStatistics>} Les statistiques
   * @throws {NotFoundException} Si l'entrepôt n'existe pas
   * 
   * @example
   * ```typescript
   * const stats = await entrepotsService.getStatistiques(1);
   * 
   * console.log(`Produits différents: ${stats.totalProduits}`);
   * console.log(`Articles totaux: ${stats.totalArticles}`);
   * console.log(`Valeur totale: ${stats.valeurTotale}€`);
   * console.log(`Stock faible: ${stats.produitsStockFaible}`);
   * console.log(`Taux remplissage: ${stats.tauxRemplissage}%`);
   * ```
   */
  async getStatistiques(entrepotId: number) {
    const entrepot = await this.findOne(entrepotId);

    const inventaire = await this.prisma.inventaire.findMany({
      where: { entrepotId },
      include: { produit: true },
    });

    const totalProduits = inventaire.length;
    const totalArticles = inventaire.reduce((sum, i) => sum + i.quantite, 0);
    const totalReserve = inventaire.reduce((sum, i) => sum + i.quantiteReservee, 0);
    const totalDisponible = totalArticles - totalReserve;

    const valeurTotale = inventaire.reduce(
      (sum, i) => sum + i.quantite * Number(i.produit.coutUnitaire || 0),
      0,
    );

    const produitsStockFaible = inventaire.filter(
      (i) => i.quantite <= i.produit.niveauStockMin,
    ).length;

    const produitsRupture = inventaire.filter(
      (i) => i.quantite === 0,
    ).length;

    // Calculer le taux de remplissage si capacité définie
    let tauxRemplissage = 0;
    if (entrepot.capacite && entrepot.capacite > 0) {
      tauxRemplissage = Math.round((totalArticles / entrepot.capacite) * 100);
    }

    return { 
      totalProduits, 
      totalArticles,
      totalReserve,
      totalDisponible,
      valeurTotale, 
      produitsStockFaible,
      produitsRupture,
      tauxRemplissage,
    };
  }

  /**
   * Obtenir les statistiques globales de tous les entrepôts
   * 
   * @returns {Promise<Object>} Statistiques globales
   * 
   * @example
   * ```typescript
   * const stats = await entrepotsService.getStatistiquesGlobales();
   * console.log(`Total entrepôts: ${stats.totalEntrepots}`);
   * console.log(`Entrepôts actifs: ${stats.entrepotsActifs}`);
   * ```
   */
  async getStatistiquesGlobales() {
    const [
      totalEntrepots,
      entrepotsActifs,
      entrepotsInactifs,
      entrepotsAvecStock,
    ] = await Promise.all([
      this.prisma.entrepot.count(),
      this.prisma.entrepot.count({
        where: { estActif: true },
      }),
      this.prisma.entrepot.count({
        where: { estActif: false },
      }),
      this.prisma.entrepot.count({
        where: {
          inventaire: {
            some: {
              quantite: { gt: 0 },
            },
          },
        },
      }),
    ]);

    return {
      totalEntrepots,
      entrepotsActifs,
      entrepotsInactifs,
      entrepotsAvecStock,
      entrepotsVides: totalEntrepots - entrepotsAvecStock,
    };
  }
}