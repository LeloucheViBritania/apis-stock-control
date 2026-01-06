import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventaireDto } from './dto/create-inventaire.dto';
import { UpdateInventaireDto } from './dto/update-inventaire.dto'
import { AjusterQuantiteDto } from './dto/ajuster-quantite.dto'
import { ReserverStockDto } from './dto/reserver-stock.dto'

/**
 * Service de gestion de l'inventaire multi-entrepôts
 * 
 * Ce service gère toutes les opérations liées à l'inventaire :
 * - CRUD complet sur les entrées d'inventaire
 * - Ajustements de quantités (ajout, retrait, définition)
 * - Réservation et libération de stock
 * - Recherche et filtrage avancés
 * - Statistiques par entrepôt et globales
 * - Gestion des emplacements physiques
 * 
 * Fonctionnalité PREMIUM - Nécessite un abonnement premium
 * 
 * @class InventaireService
 * @injectable
 */
@Injectable()
export class InventaireService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer une nouvelle entrée d'inventaire
   * 
   * Initialise l'inventaire d'un produit dans un entrepôt spécifique.
   * Vérifie qu'il n'existe pas déjà une entrée pour ce couple produit/entrepôt.
   * 
   * @param {CreateInventaireDto} createInventaireDto - Données de l'inventaire
   * @returns {Promise<Inventaire>} L'entrée d'inventaire créée
   * @throws {NotFoundException} Si le produit ou l'entrepôt n'existe pas
   * @throws {ConflictException} Si une entrée existe déjà pour ce produit dans cet entrepôt
   * 
   * @example
   * ```typescript
   * const inventaire = await inventaireService.create({
   *   produitId: 42,
   *   entrepotId: 1,
   *   quantite: 100,
   *   emplacement: 'A1-B3'
   * });
   * ```
   */
  async create(createInventaireDto: CreateInventaireDto) {
    // Vérifier que le produit existe
    const produit = await this.prisma.produit.findUnique({
      where: { id: createInventaireDto.produitId },
    });

    if (!produit) {
      throw new NotFoundException(
        `Produit #${createInventaireDto.produitId} non trouvé`
      );
    }

    // Vérifier que l'entrepôt existe
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id: createInventaireDto.entrepotId },
    });

    if (!entrepot) {
      throw new NotFoundException(
        `Entrepôt #${createInventaireDto.entrepotId} non trouvé`
      );
    }

    // Vérifier qu'il n'existe pas déjà une entrée pour ce produit dans cet entrepôt
    const existing = await this.prisma.inventaire.findFirst({
      where: {
        produitId: createInventaireDto.produitId,
        entrepotId: createInventaireDto.entrepotId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Une entrée d'inventaire existe déjà pour ce produit dans cet entrepôt (ID: ${existing.id})`
      );
    }

    return this.prisma.inventaire.create({
      data: {
        ...createInventaireDto,
        quantiteReservee: createInventaireDto.quantiteReservee || 0,
      },
      include: {
        produit: {
          select: {
            id: true,
            nom: true,
            reference: true,
            niveauStockMin: true,
            niveauStockMax: true,
          },
        },
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
      },
    });
  }

  /**
   * Récupérer tous les inventaires avec filtres optionnels
   * 
   * Permet de filtrer par entrepôt, produit, stock faible, etc.
   * 
   * @param {Object} filters - Filtres optionnels
   * @param {number} [filters.entrepotId] - Filtrer par entrepôt
   * @param {number} [filters.produitId] - Filtrer par produit
   * @param {number} [filters.categorieId] - Filtrer par catégorie de produit
   * @param {boolean} [filters.stockFaible] - Afficher uniquement les stocks faibles
   * @param {boolean} [filters.rupture] - Afficher uniquement les ruptures de stock
   * @param {string} [filters.search] - Recherche textuelle (nom produit, référence)
   * @returns {Promise<Inventaire[]>} Liste des inventaires
   * 
   * @example
   * ```typescript
   * // Tous les inventaires
   * const tous = await inventaireService.findAll();
   * 
   * // Inventaire d'un entrepôt spécifique
   * const entrepot1 = await inventaireService.findAll({ entrepotId: 1 });
   * 
   * // Stocks faibles uniquement
   * const faibles = await inventaireService.findAll({ stockFaible: true });
   * 
   * // Ruptures de stock
   * const ruptures = await inventaireService.findAll({ rupture: true });
   * ```
   */
  async findAll(
  // 1er argument : Les filtres (clause WHERE)
  filters?: {
        entrepotId?: number;
        produitId?: number;
        categorieId?: number;
        stockFaible?: boolean;
        rupture?: boolean;
        search?: string;
      },
  // 2ème argument (NOUVEAU) : La pagination (clause SKIP/TAKE)
  pagination: { page?: number; limit?: number } = {}
  ) {
      const where: any = {};

  // ... (votre logique de filtres existante reste inchangée ici) ...
  if (filters?.entrepotId) where.entrepotId = filters.entrepotId;
  if (filters?.produitId) where.produitId = filters.produitId;
  if (filters?.categorieId) where.produit = { categorieId: filters.categorieId };
  if (filters?.rupture) where.quantite = 0;
  if (filters?.search) {
    where.produit = {
      // ... votre logique de recherche OR ...
    };
  }

  // LOGIQUE DE PAGINATION PRISMA
  const page = pagination.page && pagination.page > 0 ? pagination.page : 1;
  const limit = pagination.limit && pagination.limit > 0 ? pagination.limit : 10;
  const skip = (page - 1) * limit;

      const inventaires = await this.prisma.inventaire.findMany({
        where,
  // AJOUT ICI :
  skip,
  take: limit,
        include: {
    // ... vos includes existants ...
    produit: { include: { categorie: { select: { id: true, nom: true } } } },
    entrepot: { select: { id: true, nom: true, code: true } },
        },
        orderBy: [
          { entrepot: { nom: 'asc' } },
          { produit: { nom: 'asc' } },
        ],
      });

  // Note : Le filtrage post-requête (stockFaible) pose problème avec la pagination.
  // Idéalement, il faut déplacer la logique stockFaible dans le 'where' de Prisma.
  // Sinon, vous risquez de demander 10 éléments, d'en filtrer 5, et de n'en renvoyer que 5.

      if (filters?.stockFaible) {
  // Pour une vraie pagination, cette logique devrait être dans la requête DB ci-dessus
        return inventaires.filter(
          (inv) => inv.quantite <= inv.produit.niveauStockMin
        );
      }

      return inventaires;
  }

  /**
   * Récupérer une entrée d'inventaire par son ID
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @returns {Promise<Inventaire>} L'entrée d'inventaire avec ses relations
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * 
   * @example
   * ```typescript
   * const inventaire = await inventaireService.findOne(1);
   * console.log(`${inventaire.produit.nom} à ${inventaire.entrepot.nom}`);
   * console.log(`Stock: ${inventaire.quantite}`);
   * console.log(`Réservé: ${inventaire.quantiteReservee}`);
   * console.log(`Disponible: ${inventaire.quantite - inventaire.quantiteReservee}`);
   * ```
   */
  async findOne(id: number) {
    const inventaire = await this.prisma.inventaire.findUnique({
      where: { id },
      include: {
        produit: {
          include: {
            categorie: true,
          },
        },
        entrepot: {
          include: {
            responsable: {
              select: {
                id: true,
                nomComplet: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!inventaire) {
      throw new NotFoundException(`Entrée d'inventaire #${id} non trouvée`);
    }

    return inventaire;
  }

  /**
   * Récupérer l'inventaire d'un produit spécifique dans un entrepôt
   * 
   * @param {number} produitId - ID du produit
   * @param {number} entrepotId - ID de l'entrepôt
   * @returns {Promise<Inventaire | null>} L'entrée d'inventaire ou null
   * 
   * @example
   * ```typescript
   * const stock = await inventaireService.findByProduitEntrepot(42, 1);
   * if (stock) {
   *   console.log(`Stock disponible: ${stock.quantite - stock.quantiteReservee}`);
   * } else {
   *   console.log('Produit non disponible dans cet entrepôt');
   * }
   * ```
   */
  async findByProduitEntrepot(produitId: number, entrepotId: number) {
    return this.prisma.inventaire.findFirst({
      where: {
        produitId,
        entrepotId,
      },
      include: {
        produit: true,
        entrepot: true,
      },
    });
  }

  /**
   * Mettre à jour une entrée d'inventaire
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @param {UpdateInventaireDto} updateInventaireDto - Données à mettre à jour
   * @returns {Promise<Inventaire>} L'entrée d'inventaire mise à jour
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * @throws {BadRequestException} Si la quantité réservée > quantité totale
   * 
   * @example
   * ```typescript
   * // Mettre à jour l'emplacement
   * await inventaireService.update(1, {
   *   emplacement: 'B2-C4'
   * });
   * 
   * // Enregistrer une vérification physique
   * await inventaireService.update(1, {
   *   quantite: 95,
   *   derniereVerification: new Date().toISOString()
   * });
   * ```
   */
  async update(id: number, updateInventaireDto: UpdateInventaireDto) {
    const inventaire = await this.findOne(id);

    // Vérifier que la quantité réservée ne dépasse pas la quantité totale
    const nouvelleQuantite = updateInventaireDto.quantite ?? inventaire.quantite;
    const nouvelleQuantiteReservee = updateInventaireDto.quantiteReservee ?? inventaire.quantiteReservee;

    if (nouvelleQuantiteReservee > nouvelleQuantite) {
      throw new BadRequestException(
        `La quantité réservée (${nouvelleQuantiteReservee}) ne peut pas dépasser la quantité totale (${nouvelleQuantite})`
      );
    }

    return this.prisma.inventaire.update({
      where: { id },
      data: updateInventaireDto,
      include: {
        produit: true,
        entrepot: true,
      },
    });
  }

  /**
   * Supprimer une entrée d'inventaire
   * 
   * La suppression est refusée si du stock est réservé.
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @returns {Promise<Inventaire>} L'entrée d'inventaire supprimée
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * @throws {ConflictException} Si du stock est réservé
   * 
   * @example
   * ```typescript
   * try {
   *   await inventaireService.remove(1);
   * } catch (error) {
   *   if (error instanceof ConflictException) {
   *     console.log('Impossible : stock réservé');
   *   }
   * }
   * ```
   */
  async remove(id: number) {
    const inventaire = await this.findOne(id);

    if (inventaire.quantiteReservee > 0) {
      throw new ConflictException(
        `Impossible de supprimer cette entrée car ${inventaire.quantiteReservee} unité(s) sont réservées`
      );
    }

    return this.prisma.inventaire.delete({
      where: { id },
    });
  }

  /**
   * Ajuster la quantité en stock
   * 
   * Permet d'ajouter, retirer ou définir une quantité absolue.
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @param {AjusterQuantiteDto} ajusterDto - Données d'ajustement
   * @returns {Promise<Inventaire>} L'entrée d'inventaire mise à jour
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * @throws {BadRequestException} Si l'opération résulte en une quantité négative
   * 
   * @example
   * ```typescript
   * // Ajouter 50 unités
   * await inventaireService.ajusterQuantite(1, {
   *   type: 'ajouter',
   *   quantite: 50,
   *   raison: 'Réception fournisseur'
   * });
   * 
   * // Retirer 20 unités
   * await inventaireService.ajusterQuantite(1, {
   *   type: 'retirer',
   *   quantite: 20,
   *   raison: 'Vente'
   * });
   * 
   * // Définir à 100 (inventaire physique)
   * await inventaireService.ajusterQuantite(1, {
   *   type: 'definir',
   *   quantite: 100,
   *   raison: 'Inventaire physique'
   * });
   * ```
   */
  async ajusterQuantite(id: number, ajusterDto: AjusterQuantiteDto) {
    const inventaire = await this.findOne(id);

    let nouvelleQuantite: number;

    switch (ajusterDto.type) {
      case 'ajouter':
        nouvelleQuantite = inventaire.quantite + ajusterDto.quantite;
        break;

      case 'retirer':
        nouvelleQuantite = inventaire.quantite - ajusterDto.quantite;
        if (nouvelleQuantite < 0) {
          throw new BadRequestException(
            `Impossible de retirer ${ajusterDto.quantite} unités. Stock actuel: ${inventaire.quantite}`
          );
        }
        break;

      case 'definir':
        nouvelleQuantite = ajusterDto.quantite;
        break;

      default:
        throw new BadRequestException(
          `Type d'ajustement invalide: ${ajusterDto.type}`
        );
    }

    // Vérifier que la quantité réservée ne dépasse pas la nouvelle quantité
    if (inventaire.quantiteReservee > nouvelleQuantite) {
      throw new BadRequestException(
        `Impossible : ${inventaire.quantiteReservee} unités sont réservées. Nouvelle quantité minimale requise: ${inventaire.quantiteReservee}`
      );
    }

    return this.prisma.inventaire.update({
      where: { id },
      data: {
        quantite: nouvelleQuantite,
        derniereVerification: new Date(),
      },
      include: {
        produit: true,
        entrepot: true,
      },
    });
  }

  /**
   * Réserver du stock
   * 
   * Augmente la quantité réservée pour une commande ou autre utilisation.
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @param {ReserverStockDto} reserverDto - Données de réservation
   * @returns {Promise<Inventaire>} L'entrée d'inventaire mise à jour
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * @throws {BadRequestException} Si stock disponible insuffisant
   * 
   * @example
   * ```typescript
   * await inventaireService.reserverStock(1, {
   *   quantite: 10,
   *   reference: 'CMD-2025-001'
   * });
   * ```
   */
  async reserverStock(id: number, reserverDto: ReserverStockDto) {
    const inventaire = await this.findOne(id);

    const disponible = inventaire.quantite - inventaire.quantiteReservee;

    if (disponible < reserverDto.quantite) {
      throw new BadRequestException(
        `Stock disponible insuffisant. Disponible: ${disponible}, Demandé: ${reserverDto.quantite}`
      );
    }

    return this.prisma.inventaire.update({
      where: { id },
      data: {
        quantiteReservee: inventaire.quantiteReservee + reserverDto.quantite,
      },
      include: {
        produit: true,
        entrepot: true,
      },
    });
  }

  /**
   * Libérer du stock réservé
   * 
   * Diminue la quantité réservée (annulation de commande, etc.).
   * 
   * @param {number} id - ID de l'entrée d'inventaire
   * @param {ReserverStockDto} libererDto - Données de libération
   * @returns {Promise<Inventaire>} L'entrée d'inventaire mise à jour
   * @throws {NotFoundException} Si l'entrée n'existe pas
   * @throws {BadRequestException} Si quantité à libérer > quantité réservée
   * 
   * @example
   * ```typescript
   * await inventaireService.libererStock(1, {
   *   quantite: 5,
   *   reference: 'CMD-2025-001'
   * });
   * ```
   */
  async libererStock(id: number, libererDto: ReserverStockDto) {
    const inventaire = await this.findOne(id);

    if (libererDto.quantite > inventaire.quantiteReservee) {
      throw new BadRequestException(
        `Impossible de libérer ${libererDto.quantite} unités. Quantité réservée: ${inventaire.quantiteReservee}`
      );
    }

    return this.prisma.inventaire.update({
      where: { id },
      data: {
        quantiteReservee: inventaire.quantiteReservee - libererDto.quantite,
      },
      include: {
        produit: true,
        entrepot: true,
      },
    });
  }

  /**
   * Obtenir les stocks faibles
   * 
   * Retourne tous les produits dont la quantité est inférieure ou égale au niveau minimum.
   * 
   * @param {number} [entrepotId] - Filtrer par entrepôt (optionnel)
   * @returns {Promise<Inventaire[]>} Liste des stocks faibles
   * 
   * @example
   * ```typescript
   * // Tous les stocks faibles
   * const tous = await inventaireService.getStocksFaibles();
   * 
   * // Stocks faibles d'un entrepôt spécifique
   * const entrepot1 = await inventaireService.getStocksFaibles(1);
   * ```
   */
  async getStocksFaibles(filtersOrEntrepotId?: number | { entrepotId?: number; categorieId?: number }) {
    const where: any = {};

    // Handle both number and object parameters
    if (typeof filtersOrEntrepotId === 'number') {
      where.entrepotId = filtersOrEntrepotId;
    } else if (filtersOrEntrepotId) {
      if (filtersOrEntrepotId.entrepotId) {
        where.entrepotId = filtersOrEntrepotId.entrepotId;
      }
      if (filtersOrEntrepotId.categorieId) {
        where.produit = { categorieId: filtersOrEntrepotId.categorieId };
      }
    }

    const inventaires = await this.prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          include: {
            categorie: true,
          },
        },
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
      },
    });

    return inventaires.filter(
      (inv) => inv.quantite <= inv.produit.niveauStockMin
    );
  }

  /**
   * Obtenir les ruptures de stock
   * 
   * @param {number} [entrepotId] - Filtrer par entrepôt (optionnel)
   * @returns {Promise<Inventaire[]>} Liste des ruptures
   * 
   * @example
   * ```typescript
   * const ruptures = await inventaireService.getRuptures();
   * console.log(`${ruptures.length} produit(s) en rupture`);
   * ```
   */
  async getRuptures(entrepotId?: number) {
    const where: any = {
      quantite: 0,
    };

    if (entrepotId) {
      where.entrepotId = entrepotId;
    }

    return this.prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          include: {
            categorie: true,
          },
        },
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
      },
      orderBy: {
        produit: {
          nom: 'asc',
        },
      },
    });
  }

  /**
   * Obtenir les statistiques globales de l'inventaire
   * 
   * @param {number} [entrepotId] - Filtrer par entrepôt (optionnel)
   * @returns {Promise<Object>} Statistiques
   * 
   * @example
   * ```typescript
   * const stats = await inventaireService.getStatistiques();
   * console.log(`Total produits: ${stats.totalProduits}`);
   * console.log(`Total articles: ${stats.totalArticles}`);
   * console.log(`Valeur totale: ${stats.valeurTotale}€`);
   * console.log(`Stocks faibles: ${stats.stocksFaibles}`);
   * console.log(`Ruptures: ${stats.ruptures}`);
   * ```
   */
  async getStatistiques(entrepotId?: number) {
    const where: any = {};

    if (entrepotId) {
      where.entrepotId = entrepotId;
    }

    const inventaires = await this.prisma.inventaire.findMany({
      where,
      include: {
        produit: true,
      },
    });

    const totalProduits = inventaires.length;
    const totalArticles = inventaires.reduce((sum, inv) => sum + inv.quantite, 0);
    const totalReserve = inventaires.reduce((sum, inv) => sum + inv.quantiteReservee, 0);
    const totalDisponible = totalArticles - totalReserve;

    const valeurTotale = inventaires.reduce(
      (sum, inv) => sum + inv.quantite * Number(inv.produit.coutUnitaire || 0),
      0
    );

    const stocksFaibles = inventaires.filter(
      (inv) => inv.quantite <= inv.produit.niveauStockMin
    ).length;

    const ruptures = inventaires.filter((inv) => inv.quantite === 0).length;

    const produitsAvecEmplacement = inventaires.filter(
      (inv) => inv.emplacement !== null
    ).length;

    return {
      totalProduits,
      totalArticles,
      totalReserve,
      totalDisponible,
      valeurTotale,
      stocksFaibles,
      ruptures,
      produitsAvecEmplacement,
      tauxEmplacement: totalProduits > 0 
        ? Math.round((produitsAvecEmplacement / totalProduits) * 100) 
        : 0,
    };
  }

  /**
   * Obtenir la disponibilité d'un produit dans tous les entrepôts
   * 
   * @param {number} produitId - ID du produit
   * @returns {Promise<Inventaire[]>} Liste des disponibilités par entrepôt
   * 
   * @example
   * ```typescript
   * const disponibilites = await inventaireService.getDisponibilitesProduit(42);
   * 
   * disponibilites.forEach(inv => {
   *   const dispo = inv.quantite - inv.quantiteReservee;
   *   console.log(`${inv.entrepot.nom}: ${dispo} disponible(s)`);
   * });
   * ```
   */
  async getDisponibilitesProduit(produitId: number) {
    // Vérifier que le produit existe
    const produit = await this.prisma.produit.findUnique({
      where: { id: produitId },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${produitId} non trouvé`);
    }

    return this.prisma.inventaire.findMany({
      where: { produitId },
      include: {
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
            ville: true,
            estActif: true,
          },
        },
      },
      orderBy: {
        entrepot: {
          nom: 'asc',
        },
      },
    });
  }

  // ==========================================
  // MÉTHODES SUPPLÉMENTAIRES FRONTEND
  // ==========================================

  /**
   * Obtenir les produits à commander (sous le seuil de commande)
   */
  async getACommander(entrepotId?: number) {
    const where: any = {};

    if (entrepotId) {
      where.entrepotId = entrepotId;
    }

    const inventaires = await this.prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          include: {
            categorie: { select: { id: true, nom: true } },
            produitsFournisseurs: {
              where: { estPrefere: true },
              include: {
                fournisseur: { select: { id: true, nom: true } },
              },
              take: 1,
            },
          },
        },
        entrepot: {
          select: { id: true, nom: true, code: true },
        },
      },
    });

    // Filtrer les produits sous le seuil de commande et calculer les quantités
    return (inventaires as any[])
      .filter(inv => inv.quantite <= inv.produit.niveauStockMin)
      .map(inv => {
        const quantiteACommander = Math.max(
          0,
          (inv.produit.niveauStockMax || inv.produit.niveauStockMin * 2) - inv.quantite
        );
        return {
          ...inv,
          quantiteACommander,
          fournisseurPrefere: inv.produit.produitsFournisseurs[0]?.fournisseur || null,
        };
      })
      .sort((a, b) => b.quantiteACommander - a.quantiteACommander);
  }

  /**
   * Obtenir la valeur totale de l'inventaire
   */
  async getValeur(filters?: {
    entrepotId?: number;
    categorieId?: number;
  }) {
    const where: any = {};

    if (filters?.entrepotId) {
      where.entrepotId = filters.entrepotId;
    }

    if (filters?.categorieId) {
      where.produit = { categorieId: filters.categorieId };
    }

    const inventaires = await this.prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          select: {
            id: true,
            nom: true,
            reference: true,
            coutUnitaire: true,
            prixVente: true,
            categorieId: true,
          },
        },
        entrepot: {
          select: { id: true, nom: true },
        },
      },
    });

    const valeurCout = inventaires.reduce(
      (sum, inv) => sum + inv.quantite * Number(inv.produit.coutUnitaire || 0),
      0
    );

    const valeurVente = inventaires.reduce(
      (sum, inv) => sum + inv.quantite * Number(inv.produit.prixVente || 0),
      0
    );

    const totalArticles = inventaires.reduce((sum, inv) => sum + inv.quantite, 0);
    const totalProduits = inventaires.length;

    // Grouper par entrepôt si pas de filtre entrepot
    let parEntrepot: any[] = [];
    if (!filters?.entrepotId) {
      const grouped = inventaires.reduce((acc, inv) => {
        const entId = inv.entrepot.id;
        if (!acc[entId]) {
          acc[entId] = {
            entrepot: inv.entrepot,
            valeurCout: 0,
            valeurVente: 0,
            totalArticles: 0,
            totalProduits: 0,
          };
        }
        acc[entId].valeurCout += inv.quantite * Number(inv.produit.coutUnitaire || 0);
        acc[entId].valeurVente += inv.quantite * Number(inv.produit.prixVente || 0);
        acc[entId].totalArticles += inv.quantite;
        acc[entId].totalProduits += 1;
        return acc;
      }, {} as Record<number, any>);
      parEntrepot = Object.values(grouped);
    }

    return {
      valeurCout,
      valeurVente,
      margePotentielle: valeurVente - valeurCout,
      totalArticles,
      totalProduits,
      parEntrepot,
    };
  }

  /**
   * Obtenir l'inventaire d'un produit dans tous les entrepôts
   */
  async getByProduit(produitId: number) {
    const produit = await this.prisma.produit.findUnique({
      where: { id: produitId },
      include: {
        categorie: { select: { id: true, nom: true } },
      },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${produitId} non trouvé`);
    }

    const inventaires = await this.prisma.inventaire.findMany({
      where: { produitId },
      include: {
        entrepot: {
          select: {
            id: true,
            nom: true,
            code: true,
            ville: true,
            estActif: true,
          },
        },
      },
      orderBy: {
        entrepot: { nom: 'asc' },
      },
    });

    const totalQuantite = inventaires.reduce((sum, inv) => sum + inv.quantite, 0);
    const totalReserve = inventaires.reduce((sum, inv) => sum + inv.quantiteReservee, 0);

    return {
      produit,
      inventaires,
      resume: {
        totalQuantite,
        totalReserve,
        totalDisponible: totalQuantite - totalReserve,
        nombreEntrepots: inventaires.length,
      },
    };
  }
}