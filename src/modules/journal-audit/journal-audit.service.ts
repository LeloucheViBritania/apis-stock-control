import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service de gestion du journal d'audit
 * 
 * Ce service permet de consulter et analyser les logs d'audit :
 * - Consultation des logs avec filtres
 * - Historique par utilisateur
 * - Historique par table/enregistrement
 * - Statistiques d'utilisation
 * - Détection d'anomalies
 * 
 * Fonctionnalité PREMIUM - Nécessite un abonnement premium
 * 
 * @class JournalAuditService
 * @injectable
 */
@Injectable()
export class JournalAuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer tous les logs d'audit avec filtres
   * 
   * @param {Object} filters - Filtres optionnels
   * @param {number} [filters.utilisateurId] - Filtrer par utilisateur
   * @param {string} [filters.action] - Filtrer par action (ex: 'CREATE_PRODUIT')
   * @param {string} [filters.nomTable] - Filtrer par table
   * @param {number} [filters.enregistrementId] - Filtrer par ID d'enregistrement
   * @param {Date} [filters.dateDebut] - Date de début
   * @param {Date} [filters.dateFin] - Date de fin
   * @param {number} [filters.page] - Numéro de page (pagination)
   * @param {number} [filters.limit] - Nombre de résultats par page
   * @returns {Promise<Object>} Liste paginée des logs
   * 
   * @example
   * ```typescript
   * // Tous les logs
   * const logs = await service.findAll();
   * 
   * // Logs d'un utilisateur
   * const userLogs = await service.findAll({ utilisateurId: 1 });
   * 
   * // Logs de création de produits
   * const createLogs = await service.findAll({ 
   *   action: 'CREATE_PRODUIT',
   *   dateDebut: new Date('2025-01-01'),
   *   dateFin: new Date('2025-12-31')
   * });
   * ```
   */
  async findAll(filters?: {
    utilisateurId?: number;
    action?: string;
    nomTable?: string;
    enregistrementId?: number;
    dateDebut?: Date;
    dateFin?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.utilisateurId) {
      where.utilisateurId = filters.utilisateurId;
    }

    if (filters?.action) {
      where.action = {
        contains: filters.action,
        mode: 'insensitive',
      };
    }

    if (filters?.nomTable) {
      where.nomTable = filters.nomTable;
    }

    if (filters?.enregistrementId) {
      where.enregistrementId = filters.enregistrementId;
    }

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCreation = {};
      if (filters.dateDebut) {
        where.dateCreation.gte = filters.dateDebut;
      }
      if (filters.dateFin) {
        where.dateCreation.lte = filters.dateFin;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.journalAudit.findMany({
        where,
        include: {
          utilisateur: {
            select: {
              id: true,
              nomUtilisateur: true,
              nomComplet: true,
              email: true,
            },
          },
        },
        orderBy: {
          dateCreation: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.journalAudit.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer un log d'audit par son ID
   * 
   * @param {number} id - ID du log
   * @returns {Promise<JournalAudit>} Le log avec ses relations
   * @throws {NotFoundException} Si le log n'existe pas
   * 
   * @example
   * ```typescript
   * const log = await service.findOne(1);
   * console.log(log.action);
   * console.log(log.utilisateur.nomComplet);
   * console.log(log.nouvellesValeurs);
   * ```
   */
  async findOne(id: number) {
    const log = await this.prisma.journalAudit.findUnique({
      where: { id },
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException(`Log d'audit #${id} non trouvé`);
    }

    return log;
  }

  /**
   * Récupérer l'historique d'un utilisateur
   * 
   * @param {number} utilisateurId - ID de l'utilisateur
   * @param {number} [limit] - Nombre de logs à récupérer
   * @returns {Promise<JournalAudit[]>} Liste des logs de l'utilisateur
   * 
   * @example
   * ```typescript
   * // 50 dernières actions de l'utilisateur
   * const history = await service.getHistoriqueUtilisateur(1);
   * 
   * // 100 dernières actions
   * const history = await service.getHistoriqueUtilisateur(1, 100);
   * ```
   */
  async getHistoriqueUtilisateur(utilisateurId: number, limit: number = 50) {
    return this.prisma.journalAudit.findMany({
      where: { utilisateurId },
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Récupérer l'historique d'un enregistrement spécifique
   * 
   * Permet de voir toutes les modifications d'un enregistrement particulier.
   * 
   * @param {string} nomTable - Nom de la table
   * @param {number} enregistrementId - ID de l'enregistrement
   * @returns {Promise<JournalAudit[]>} Historique complet de l'enregistrement
   * 
   * @example
   * ```typescript
   * // Historique du produit #42
   * const history = await service.getHistoriqueEnregistrement('produits', 42);
   * 
   * // Afficher les changements
   * history.forEach(log => {
   *   console.log(`${log.dateCreation}: ${log.action}`);
   *   console.log(`Par: ${log.utilisateur.nomComplet}`);
   *   console.log(`Modifications:`, log.nouvellesValeurs);
   * });
   * ```
   */
  async getHistoriqueEnregistrement(nomTable: string, enregistrementId: number) {
    return this.prisma.journalAudit.findMany({
      where: {
        nomTable,
        enregistrementId,
      },
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
            email: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'asc', // Du plus ancien au plus récent
      },
    });
  }

  /**
   * Obtenir les statistiques d'utilisation
   * 
   * Retourne des métriques sur l'activité dans le système.
   * 
   * @param {Date} [dateDebut] - Date de début (optionnel)
   * @param {Date} [dateFin] - Date de fin (optionnel)
   * @returns {Promise<Object>} Statistiques d'utilisation
   * 
   * @example
   * ```typescript
   * // Statistiques globales
   * const stats = await service.getStatistiques();
   * 
   * // Statistiques du mois
   * const statsMonth = await service.getStatistiques(
   *   new Date('2025-11-01'),
   *   new Date('2025-11-30')
   * );
   * 
   * console.log(`Total actions: ${stats.totalActions}`);
   * console.log(`Utilisateurs actifs: ${stats.utilisateursActifs}`);
   * console.log(`Actions par type:`, stats.actionsParType);
   * ```
   */
  async getStatistiques(dateDebut?: Date, dateFin?: Date) {
    const where: any = {};

    if (dateDebut || dateFin) {
      where.dateCreation = {};
      if (dateDebut) {
        where.dateCreation.gte = dateDebut;
      }
      if (dateFin) {
        where.dateCreation.lte = dateFin;
      }
    }

    const [
      totalActions,
      utilisateursActifs,
      actionsParType,
      tablesModifiees,
    ] = await Promise.all([
      // Total d'actions
      this.prisma.journalAudit.count({ where }),

      // Nombre d'utilisateurs uniques
      this.prisma.journalAudit.groupBy({
        by: ['utilisateurId'],
        where,
        _count: true,
      }).then(results => results.length),

      // Actions par type
      this.prisma.journalAudit.groupBy({
        by: ['action'],
        where,
        _count: {
          action: true,
        },
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
      }),

      // Tables les plus modifiées
      this.prisma.journalAudit.groupBy({
        by: ['nomTable'],
        where: {
          ...where,
          nomTable: { not: null },
        },
        _count: {
          nomTable: true,
        },
        orderBy: {
          _count: {
            nomTable: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      totalActions,
      utilisateursActifs,
      actionsParType: actionsParType.map(a => ({
        action: a.action,
        count: a._count.action,
      })),
      tablesModifiees: tablesModifiees.map(t => ({
        table: t.nomTable,
        count: t._count.nomTable,
      })),
    };
  }

  /**
   * Obtenir les utilisateurs les plus actifs
   * 
   * @param {number} [limit] - Nombre d'utilisateurs à retourner
   * @param {Date} [dateDebut] - Date de début (optionnel)
   * @param {Date} [dateFin] - Date de fin (optionnel)
   * @returns {Promise<Array>} Liste des utilisateurs avec leur nombre d'actions
   * 
   * @example
   * ```typescript
   * // Top 10 utilisateurs actifs
   * const top = await service.getUtilisateursPlusActifs(10);
   * 
   * top.forEach(user => {
   *   console.log(`${user.nomComplet}: ${user.nombreActions} actions`);
   * });
   * ```
   */
  async getUtilisateursPlusActifs(
    limit: number = 10,
    dateDebut?: Date,
    dateFin?: Date,
  ) {
    const where: any = {
      utilisateurId: { not: null },
    };

    if (dateDebut || dateFin) {
      where.dateCreation = {};
      if (dateDebut) {
        where.dateCreation.gte = dateDebut;
      }
      if (dateFin) {
        where.dateCreation.lte = dateFin;
      }
    }

    const results = await this.prisma.journalAudit.groupBy({
      by: ['utilisateurId'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    // Récupérer les informations des utilisateurs
    const utilisateursIds = results.map(r => r.utilisateurId).filter(Boolean) as number[];
    
    const utilisateurs = await this.prisma.utilisateur.findMany({
      where: {
        id: { in: utilisateursIds },
      },
      select: {
        id: true,
        nomUtilisateur: true,
        nomComplet: true,
        email: true,
        role: true,
      },
    });

    // Combiner les résultats
    return results.map(r => {
      const user = utilisateurs.find(u => u.id === r.utilisateurId);
      return {
        ...user,
        nombreActions: r._count.id,
      };
    });
  }

  /**
   * Obtenir l'activité récente
   * 
   * Retourne les dernières actions effectuées dans le système.
   * 
   * @param {number} [limit] - Nombre d'actions à retourner
   * @returns {Promise<JournalAudit[]>} Liste des actions récentes
   * 
   * @example
   * ```typescript
   * // 20 dernières actions
   * const recent = await service.getActiviteRecente(20);
   * 
   * recent.forEach(log => {
   *   console.log(`${log.dateCreation}: ${log.utilisateur.nomComplet} - ${log.action}`);
   * });
   * ```
   */
  async getActiviteRecente(limit: number = 20) {
    return this.prisma.journalAudit.findMany({
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
            role: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Rechercher dans les logs
   * 
   * Permet de rechercher dans les nouvelles valeurs JSON.
   * 
   * @param {string} searchTerm - Terme de recherche
   * @param {number} [limit] - Nombre de résultats
   * @returns {Promise<JournalAudit[]>} Logs correspondants
   * 
   * @example
   * ```typescript
   * // Rechercher tous les logs contenant "urgent"
   * const results = await service.rechercher('urgent');
   * ```
   */
  async rechercher(searchTerm: string, limit: number = 50) {
    // Note: La recherche dans JSONB peut être complexe
    // Cette implémentation est basique et peut être améliorée
    const logs = await this.prisma.journalAudit.findMany({
      where: {
        OR: [
          {
            action: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            nomTable: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'desc',
      },
      take: limit,
    });

    return logs;
  }

  /**
   * Supprimer les logs anciens
   * 
   * Permet de nettoyer les logs plus vieux qu'une certaine date.
   * 
   * @param {Date} dateAvant - Supprimer les logs avant cette date
   * @returns {Promise<number>} Nombre de logs supprimés
   * 
   * @example
   * ```typescript
   * // Supprimer les logs de plus de 1 an
   * const oneYearAgo = new Date();
   * oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
   * 
   * const deleted = await service.supprimerLogsAnciens(oneYearAgo);
   * console.log(`${deleted} logs supprimés`);
   * ```
   */
  async supprimerLogsAnciens(dateAvant: Date) {
    const result = await this.prisma.journalAudit.deleteMany({
      where: {
        dateCreation: {
          lt: dateAvant,
        },
      },
    });

    return result.count;
  }

  /**
   * Exporter les logs au format JSON
   * 
   * @param {Object} filters - Mêmes filtres que findAll
   * @returns {Promise<any[]>} Logs au format JSON
   * 
   * @example
   * ```typescript
   * // Exporter les logs d'un utilisateur
   * const export = await service.exporterLogs({ utilisateurId: 1 });
   * 
   * // Sauvegarder dans un fichier
   * fs.writeFileSync('logs.json', JSON.stringify(export, null, 2));
   * ```
   */
  async exporterLogs(filters?: {
    utilisateurId?: number;
    action?: string;
    nomTable?: string;
    dateDebut?: Date;
    dateFin?: Date;
  }) {
    const where: any = {};

    if (filters?.utilisateurId) {
      where.utilisateurId = filters.utilisateurId;
    }

    if (filters?.action) {
      where.action = {
        contains: filters.action,
        mode: 'insensitive',
      };
    }

    if (filters?.nomTable) {
      where.nomTable = filters.nomTable;
    }

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCreation = {};
      if (filters.dateDebut) {
        where.dateCreation.gte = filters.dateDebut;
      }
      if (filters.dateFin) {
        where.dateCreation.lte = filters.dateFin;
      }
    }

    return this.prisma.journalAudit.findMany({
      where,
      include: {
        utilisateur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'desc',
      },
    });
  }
}