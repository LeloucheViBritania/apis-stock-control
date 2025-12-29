// ============================================
// FICHIER: src/modules/inventaire/inventaire-import.service.ts
// Service d'import spécialisé pour l'inventaire (PREMIUM)
// Mise à jour de stock en masse
// ============================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService, ImportColumn, ImportResult } from '../../common/services/import.service';

export interface ImportInventaireOptions {
  /** Mode de mise à jour: 'replace' = remplacer, 'adjust' = ajuster (+/-) */
  mode?: 'replace' | 'adjust';
  /** ID de l'entrepôt cible (obligatoire) */
  entrepotId: number;
  /** Ignorer les erreurs et continuer l'import */
  skipErrors?: boolean;
  /** Créer les produits manquants */
  createMissingProducts?: boolean;
  /** Raison de l'ajustement (pour le journal) */
  raison?: string;
  /** Utilisateur effectuant l'import */
  userId?: number;
}

export interface ImportInventaireResult extends ImportResult {
  summary: {
    updated: number;
    created: number;
    skipped: number;
    adjustments: {
      positive: number;
      negative: number;
      zero: number;
    };
  };
}

@Injectable()
export class InventaireImportService {
  private readonly logger = new Logger(InventaireImportService.name);

  constructor(
    private prisma: PrismaService,
    private importService: ImportService,
  ) {}

  /**
   * Colonnes attendues pour l'import d'inventaire
   */
  getColumns(): ImportColumn[] {
    return [
      {
        header: 'Reference Produit',
        key: 'reference',
        required: true,
        type: 'string',
        validate: (value) => {
          if (!value || value.length < 2) {
            return 'La référence produit est obligatoire';
          }
          return true;
        },
        transform: (value) => String(value).toUpperCase().trim(),
      },
      {
        header: 'Quantite',
        key: 'quantite',
        required: true,
        type: 'number',
        validate: (value) => {
          if (isNaN(value)) {
            return 'La quantité doit être un nombre';
          }
          return true;
        },
      },
      {
        header: 'Emplacement',
        key: 'emplacement',
        required: false,
        type: 'string',
      },
      {
        header: 'Cout Unitaire',
        key: 'coutUnitaire',
        required: false,
        type: 'number',
      },
      {
        header: 'Notes',
        key: 'notes',
        required: false,
        type: 'string',
      },
    ];
  }

  /**
   * Importer/Mettre à jour l'inventaire depuis un fichier
   */
  async import(
    file: Express.Multer.File,
    options: ImportInventaireOptions,
  ): Promise<ImportInventaireResult> {
    const { 
      mode = 'replace', 
      entrepotId, 
      skipErrors = false, 
      createMissingProducts = false,
      raison = 'Import en masse',
      userId,
    } = options;

    // Vérifier que l'entrepôt existe
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id: entrepotId },
    });

    if (!entrepot) {
      throw new BadRequestException(`Entrepôt #${entrepotId} non trouvé`);
    }

    this.logger.log(`Début import inventaire - Entrepôt: ${entrepot.nom}, Mode: ${mode}`);

    // Parser le fichier
    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 5000,
    });

    if (parseResult.errors.length > 0 && !skipErrors) {
      return {
        ...parseResult,
        summary: { 
          updated: 0, 
          created: 0, 
          skipped: parseResult.errorRows,
          adjustments: { positive: 0, negative: 0, zero: 0 },
        },
      };
    }

    // Récupérer les produits par référence
    const references = parseResult.data.map((d) => d.reference);
    const produitsMap = await this.getProduitsMap(references);

    // Récupérer l'inventaire existant pour cet entrepôt
    const inventaireMap = await this.getInventaireMap(entrepotId, references);

    // Traiter l'import
    const summary = { 
      updated: 0, 
      created: 0, 
      skipped: 0,
      adjustments: { positive: 0, negative: 0, zero: 0 },
    };
    const errors = [...parseResult.errors];

    // Utiliser une transaction pour la cohérence
    await this.prisma.$transaction(async (tx) => {
      for (const data of parseResult.data) {
        try {
          const produit = produitsMap.get(data.reference);

          if (!produit) {
            if (createMissingProducts) {
              errors.push({
                row: parseResult.data.indexOf(data) + 2,
                column: 'Reference Produit',
                value: data.reference,
                message: `Création de produits non implémentée. Produit ${data.reference} ignoré.`,
              });
            } else {
              errors.push({
                row: parseResult.data.indexOf(data) + 2,
                column: 'Reference Produit',
                value: data.reference,
                message: `Produit non trouvé: ${data.reference}`,
              });
            }
            summary.skipped++;
            continue;
          }

          const existingInventaire = inventaireMap.get(produit.id);
          const nouvelleQuantite = this.calculateNewQuantity(
            mode, 
            existingInventaire?.quantite || 0, 
            data.quantite,
          );

          // Vérifier que la quantité n'est pas négative en mode adjust
          if (nouvelleQuantite < 0) {
            errors.push({
              row: parseResult.data.indexOf(data) + 2,
              column: 'Quantite',
              value: data.quantite,
              message: `L'ajustement résulterait en une quantité négative (${nouvelleQuantite})`,
            });
            summary.skipped++;
            continue;
          }

          // Calculer l'ajustement
          const adjustment = nouvelleQuantite - (existingInventaire?.quantite || 0);
          if (adjustment > 0) summary.adjustments.positive++;
          else if (adjustment < 0) summary.adjustments.negative++;
          else summary.adjustments.zero++;

          if (existingInventaire) {
            // Mettre à jour l'inventaire existant
            await tx.inventaire.update({
              where: { id: existingInventaire.id },
              data: {
                quantite: nouvelleQuantite,
                emplacement: data.emplacement || existingInventaire.emplacement,
                derniereVerification: new Date(),
              },
            });

            // Créer un mouvement de stock si ajustement non nul
            if (adjustment !== 0) {
              await tx.mouvementStock.create({
                data: {
                  produitId: produit.id,
                  entrepotId,
                  typeMouvement: 'AJUSTEMENT',
                  quantite: Math.abs(adjustment),
                  raison: `${raison} - ${adjustment > 0 ? 'Ajout' : 'Retrait'}`,
                  coutUnitaire: data.coutUnitaire || produit.coutUnitaire,
                  effectuePar: userId,
                  notes: data.notes || `Import fichier: ${file.originalname}`,
                },
              });
            }

            // Mettre à jour le stock global du produit
            await tx.produit.update({
              where: { id: produit.id },
              data: {
                quantiteStock: {
                  increment: adjustment,
                },
              },
            });

            summary.updated++;
          } else {
            // Créer une nouvelle entrée d'inventaire
            await tx.inventaire.create({
              data: {
                produitId: produit.id,
                entrepotId,
                quantite: nouvelleQuantite,
                emplacement: data.emplacement || null,
                quantiteReservee: 0,
              },
            });

            // Créer un mouvement d'entrée
            if (nouvelleQuantite > 0) {
              await tx.mouvementStock.create({
                data: {
                  produitId: produit.id,
                  entrepotId,
                  typeMouvement: 'ENTREE',
                  quantite: nouvelleQuantite,
                  raison: raison,
                  coutUnitaire: data.coutUnitaire || produit.coutUnitaire,
                  effectuePar: userId,
                  notes: data.notes || `Import fichier: ${file.originalname}`,
                },
              });
            }

            // Mettre à jour le stock global du produit
            await tx.produit.update({
              where: { id: produit.id },
              data: {
                quantiteStock: {
                  increment: nouvelleQuantite,
                },
              },
            });

            summary.created++;
          }
        } catch (error) {
          this.logger.error(`Erreur import inventaire ${data.reference}: ${error.message}`);
          
          if (!skipErrors) {
            throw error; // Rollback la transaction
          }
          
          errors.push({
            row: parseResult.data.indexOf(data) + 2,
            message: `Erreur lors de l'import: ${error.message}`,
          });
          summary.skipped++;
        }
      }
    });

    this.logger.log(
      `Import terminé - Créés: ${summary.created}, Mis à jour: ${summary.updated}, Ignorés: ${summary.skipped}`,
    );

    return {
      success: errors.length === 0,
      totalRows: parseResult.totalRows,
      importedRows: summary.created + summary.updated,
      errorRows: errors.length,
      errors,
      data: [],
      warnings: parseResult.warnings,
      summary,
    };
  }

  /**
   * Prévisualiser un fichier d'import
   */
  async preview(file: Express.Multer.File, entrepotId: number): Promise<any> {
    // Vérifier que l'entrepôt existe
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id: entrepotId },
    });

    if (!entrepot) {
      throw new BadRequestException(`Entrepôt #${entrepotId} non trouvé`);
    }

    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 20,
    });

    // Récupérer les infos produits pour l'aperçu
    const references = parseResult.data.map((d) => d.reference);
    const produitsMap = await this.getProduitsMap(references);
    const inventaireMap = await this.getInventaireMap(entrepotId, references);

    const previewWithDetails = parseResult.data.slice(0, 10).map((d) => {
      const produit = produitsMap.get(d.reference);
      const inventaire = produit ? inventaireMap.get(produit.id) : null;

      return {
        ...d,
        produitTrouve: !!produit,
        produitNom: produit?.nom || 'Non trouvé',
        stockActuel: inventaire?.quantite || 0,
        nouveauStock: d.quantite,
        difference: d.quantite - (inventaire?.quantite || 0),
      };
    });

    const produitsNonTrouves = parseResult.data.filter(
      (d) => !produitsMap.has(d.reference),
    ).length;

    return {
      entrepot: {
        id: entrepot.id,
        nom: entrepot.nom,
        code: entrepot.code,
      },
      preview: previewWithDetails,
      totalRows: parseResult.totalRows,
      validRows: parseResult.importedRows,
      errorRows: parseResult.errorRows,
      produitsNonTrouves,
      errors: parseResult.errors.slice(0, 10),
      isValid: parseResult.errors.length === 0 && produitsNonTrouves === 0,
      warnings: produitsNonTrouves > 0 
        ? [`${produitsNonTrouves} produit(s) non trouvé(s) dans la base`]
        : [],
    };
  }

  /**
   * Générer un modèle de fichier d'import
   */
  async getTemplate(format: 'csv' | 'xlsx' = 'xlsx', entrepotId?: number): Promise<Buffer> {
    let exampleData = [
      {
        reference: 'PROD-001',
        quantite: 100,
        emplacement: 'A1-B2',
        coutUnitaire: 5000,
        notes: 'Stock initial',
      },
      {
        reference: 'PROD-002',
        quantite: 50,
        emplacement: 'A2-C1',
        coutUnitaire: 12000,
        notes: 'Inventaire physique',
      },
    ];

    // Si un entrepôt est spécifié, utiliser les vraies références
    if (entrepotId) {
      const inventaire = await this.prisma.inventaire.findMany({
        where: { entrepotId },
        include: {
          produit: {
            select: { reference: true, nom: true, coutUnitaire: true },
          },
        },
        take: 5,
      });

      if (inventaire.length > 0) {
        exampleData = inventaire.map((i) => ({
          reference: i.produit.reference,
          quantite: i.quantite,
          emplacement: i.emplacement || '',
          coutUnitaire: Number(i.produit.coutUnitaire) || 0,
          notes: '',
        }));
      }
    }

    return this.importService.generateTemplate(this.getColumns(), format, exampleData);
  }

  /**
   * Calculer la nouvelle quantité selon le mode
   */
  private calculateNewQuantity(
    mode: 'replace' | 'adjust',
    currentQuantity: number,
    importedQuantity: number,
  ): number {
    if (mode === 'replace') {
      return importedQuantity;
    }
    // Mode adjust: ajouter ou soustraire
    return currentQuantity + importedQuantity;
  }

  /**
   * Récupérer les produits par référence
   */
  private async getProduitsMap(
    references: string[],
  ): Promise<Map<string, { id: number; nom: string; coutUnitaire: any }>> {
    const produits = await this.prisma.produit.findMany({
      where: {
        reference: { in: references },
      },
      select: { id: true, reference: true, nom: true, coutUnitaire: true },
    });

    const map = new Map();
    produits.forEach((p) => {
      map.set(p.reference.toUpperCase(), p);
    });

    return map;
  }

  /**
   * Récupérer l'inventaire existant
   */
  private async getInventaireMap(
    entrepotId: number,
    references: string[],
  ): Promise<Map<number, { id: number; quantite: number; emplacement: string | null }>> {
    const inventaire = await this.prisma.inventaire.findMany({
      where: {
        entrepotId,
        produit: {
          reference: { in: references },
        },
      },
      select: { 
        id: true, 
        produitId: true, 
        quantite: true, 
        emplacement: true,
      },
    });

    const map = new Map();
    inventaire.forEach((i) => {
      map.set(i.produitId, i);
    });

    return map;
  }
}