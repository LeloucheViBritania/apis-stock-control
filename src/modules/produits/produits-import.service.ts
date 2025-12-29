// ============================================
// FICHIER: src/modules/produits/produits-import.service.ts
// Service d'import spécialisé pour les produits
// ============================================

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService, ImportColumn, ImportResult } from '../../common/services/import.service';

export interface ImportProduitsOptions {
  /** Mode d'import: 'create' = création seule, 'update' = mise à jour seule, 'upsert' = les deux */
  mode?: 'create' | 'update' | 'upsert';
  /** Ignorer les erreurs et continuer l'import */
  skipErrors?: boolean;
  /** ID de la catégorie par défaut */
  categorieDefautId?: number;
  /** Utilisateur effectuant l'import */
  userId?: number;
}

export interface ImportProduitsResult extends ImportResult {
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

@Injectable()
export class ProduitsImportService {
  private readonly logger = new Logger(ProduitsImportService.name);

  constructor(
    private prisma: PrismaService,
    private importService: ImportService,
  ) {}

  /**
   * Colonnes attendues pour l'import des produits
   */
  getColumns(): ImportColumn[] {
    return [
      {
        header: 'Reference',
        key: 'reference',
        required: true,
        type: 'string',
        validate: (value) => {
          if (!value || value.length < 2) {
            return 'La référence doit contenir au moins 2 caractères';
          }
          if (value.length > 50) {
            return 'La référence ne peut pas dépasser 50 caractères';
          }
          return true;
        },
      },
      {
        header: 'Nom',
        key: 'nom',
        required: true,
        type: 'string',
        validate: (value) => {
          if (!value || value.length < 2) {
            return 'Le nom doit contenir au moins 2 caractères';
          }
          return true;
        },
      },
      {
        header: 'Description',
        key: 'description',
        required: false,
        type: 'string',
      },
      {
        header: 'Categorie',
        key: 'categorie',
        required: false,
        type: 'string',
      },
      {
        header: 'Marque',
        key: 'marque',
        required: false,
        type: 'string',
      },
      {
        header: 'Unite',
        key: 'uniteMesure',
        required: false,
        type: 'string',
        defaultValue: 'unité',
      },
      {
        header: 'Code Barre',
        key: 'codeBarre',
        required: false,
        type: 'string',
      },
      {
        header: 'Cout Unitaire',
        key: 'coutUnitaire',
        required: false,
        type: 'number',
        defaultValue: 0,
        validate: (value) => {
          if (value < 0) return 'Le coût unitaire ne peut pas être négatif';
          return true;
        },
      },
      {
        header: 'Prix Vente',
        key: 'prixVente',
        required: false,
        type: 'number',
        defaultValue: 0,
        validate: (value) => {
          if (value < 0) return 'Le prix de vente ne peut pas être négatif';
          return true;
        },
      },
      {
        header: 'Taux Taxe',
        key: 'tauxTaxe',
        required: false,
        type: 'number',
        defaultValue: 0,
        validate: (value) => {
          if (value < 0 || value > 100) return 'Le taux de taxe doit être entre 0 et 100';
          return true;
        },
        transform: (value) => value / 100, // Convertir pourcentage en décimal
      },
      {
        header: 'Stock Initial',
        key: 'quantiteStock',
        required: false,
        type: 'number',
        defaultValue: 0,
        validate: (value) => {
          if (value < 0) return 'Le stock initial ne peut pas être négatif';
          return true;
        },
      },
      {
        header: 'Stock Minimum',
        key: 'niveauStockMin',
        required: false,
        type: 'number',
        defaultValue: 0,
      },
      {
        header: 'Stock Maximum',
        key: 'niveauStockMax',
        required: false,
        type: 'number',
      },
      {
        header: 'Point Commande',
        key: 'pointCommande',
        required: false,
        type: 'number',
      },
      {
        header: 'Actif',
        key: 'estActif',
        required: false,
        type: 'boolean',
        defaultValue: true,
      },
    ];
  }

  /**
   * Importer des produits depuis un fichier
   */
  async import(
    file: Express.Multer.File,
    options: ImportProduitsOptions = {},
  ): Promise<ImportProduitsResult> {
    const { mode = 'upsert', skipErrors = false, categorieDefautId, userId } = options;

    this.logger.log(`Début import produits - Mode: ${mode}`);

    // Parser le fichier
    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 1000, // Limite de sécurité
    });

    if (parseResult.errors.length > 0 && !skipErrors) {
      return {
        ...parseResult,
        summary: { created: 0, updated: 0, skipped: parseResult.errorRows },
      };
    }

    // Pré-traitement : récupérer les catégories existantes
    const categoriesMap = await this.buildCategoriesMap();

    // Récupérer les références existantes
    const existingReferences = await this.getExistingReferences(
      parseResult.data.map((p) => p.reference),
    );

    // Importer les produits
    const summary = { created: 0, updated: 0, skipped: 0 };
    const errors = [...parseResult.errors];

    for (const produitData of parseResult.data) {
      try {
        const exists = existingReferences.has(produitData.reference.toUpperCase());

        // Vérifier le mode
        if (mode === 'create' && exists) {
          summary.skipped++;
          continue;
        }
        if (mode === 'update' && !exists) {
          summary.skipped++;
          continue;
        }

        // Résoudre la catégorie
        let categorieId = categorieDefautId;
        if (produitData.categorie) {
          const catName = produitData.categorie.toLowerCase();
          if (categoriesMap.has(catName)) {
            categorieId = categoriesMap.get(catName);
          } else {
            // Créer la catégorie si elle n'existe pas
            const newCat = await this.prisma.categorie.create({
              data: { nom: produitData.categorie },
            });
            categoriesMap.set(catName, newCat.id);
            categorieId = newCat.id;
          }
        }

        // Préparer les données
        const data = {
          reference: produitData.reference.toUpperCase(),
          nom: produitData.nom,
          description: produitData.description || null,
          marque: produitData.marque || null,
          uniteMesure: produitData.uniteMesure || 'unité',
          codeBarre: produitData.codeBarre || null,
          coutUnitaire: produitData.coutUnitaire || 0,
          prixVente: produitData.prixVente || 0,
          tauxTaxe: produitData.tauxTaxe || 0,
          quantiteStock: produitData.quantiteStock || 0,
          niveauStockMin: produitData.niveauStockMin || 0,
          niveauStockMax: produitData.niveauStockMax || null,
          pointCommande: produitData.pointCommande || null,
          estActif: produitData.estActif !== false,
          categorieId: categorieId || null,
        };

        if (exists) {
          // Mise à jour
          await this.prisma.produit.update({
            where: { reference: data.reference },
            data,
          });
          summary.updated++;
        } else {
          // Création
          await this.prisma.produit.create({ data });
          summary.created++;
        }
      } catch (error) {
        this.logger.error(`Erreur import produit ${produitData.reference}: ${error.message}`);
        
        if (!skipErrors) {
          errors.push({
            row: parseResult.data.indexOf(produitData) + 2,
            message: `Erreur lors de l'import: ${error.message}`,
          });
        }
      }
    }

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
  async preview(file: Express.Multer.File): Promise<any> {
    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 10, // Seulement les 10 premières lignes
    });

    return {
      preview: parseResult.data.slice(0, 5),
      totalRows: parseResult.totalRows,
      validRows: parseResult.importedRows,
      errorRows: parseResult.errorRows,
      errors: parseResult.errors.slice(0, 10), // Max 10 erreurs
      isValid: parseResult.errors.length === 0,
    };
  }

  /**
   * Générer un modèle de fichier d'import
   */
  async getTemplate(format: 'csv' | 'xlsx' = 'xlsx'): Promise<Buffer> {
    const exampleData = [
      {
        reference: 'PROD-001',
        nom: 'Ordinateur Portable HP',
        description: 'HP ProBook 450 G8',
        categorie: 'Informatique',
        marque: 'HP',
        uniteMesure: 'unité',
        codeBarre: '1234567890123',
        coutUnitaire: 450000,
        prixVente: 550000,
        tauxTaxe: 18,
        quantiteStock: 10,
        niveauStockMin: 5,
        niveauStockMax: 50,
        pointCommande: 8,
        estActif: true,
      },
      {
        reference: 'PROD-002',
        nom: 'Souris sans fil',
        description: 'Souris optique Logitech',
        categorie: 'Accessoires',
        marque: 'Logitech',
        uniteMesure: 'unité',
        codeBarre: '9876543210987',
        coutUnitaire: 8000,
        prixVente: 12000,
        tauxTaxe: 18,
        quantiteStock: 50,
        niveauStockMin: 20,
        niveauStockMax: 200,
        pointCommande: 30,
        estActif: true,
      },
    ];

    return this.importService.generateTemplate(this.getColumns(), format, exampleData);
  }

  /**
   * Construire une map des catégories existantes
   */
  private async buildCategoriesMap(): Promise<Map<string, number>> {
    const categories = await this.prisma.categorie.findMany({
      select: { id: true, nom: true },
    });

    const map = new Map<string, number>();
    categories.forEach((cat) => {
      map.set(cat.nom.toLowerCase(), cat.id);
    });

    return map;
  }

  /**
   * Récupérer les références de produits existantes
   */
  private async getExistingReferences(references: string[]): Promise<Set<string>> {
    const products = await this.prisma.produit.findMany({
      where: {
        reference: {
          in: references.map((r) => r.toUpperCase()),
        },
      },
      select: { reference: true },
    });

    return new Set(products.map((p) => p.reference.toUpperCase()));
  }
}