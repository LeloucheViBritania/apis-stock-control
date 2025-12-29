// ============================================
// FICHIER: src/modules/fournisseurs/fournisseurs-import.service.ts
// Service d'import spécialisé pour les fournisseurs
// ============================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService, ImportColumn, ImportResult } from '../../common/services/import.service';

export interface ImportFournisseursOptions {
  /** Mode d'import: 'create' = création seule, 'update' = mise à jour seule, 'upsert' = les deux */
  mode?: 'create' | 'update' | 'upsert';
  /** Ignorer les erreurs et continuer l'import */
  skipErrors?: boolean;
  /** Clé unique pour détecter les doublons */
  uniqueKey?: 'email' | 'code' | 'nom';
}

export interface ImportFournisseursResult extends ImportResult {
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

@Injectable()
export class FournisseursImportService {
  private readonly logger = new Logger(FournisseursImportService.name);

  constructor(
    private prisma: PrismaService,
    private importService: ImportService,
  ) {}

  /**
   * Colonnes attendues pour l'import des fournisseurs
   */
  getColumns(): ImportColumn[] {
    return [
      {
        header: 'Code',
        key: 'code',
        required: false,
        type: 'string',
        transform: (value) => value ? String(value).toUpperCase() : null,
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
          if (value.length > 100) {
            return 'Le nom ne peut pas dépasser 100 caractères';
          }
          return true;
        },
      },
      {
        header: 'Email',
        key: 'email',
        required: false,
        type: 'email',
      },
      {
        header: 'Telephone',
        key: 'telephone',
        required: false,
        type: 'string',
        transform: (value) => {
          if (!value) return null;
          return String(value).replace(/[^\d+]/g, '');
        },
      },
      {
        header: 'Adresse',
        key: 'adresse',
        required: false,
        type: 'string',
      },
      {
        header: 'Ville',
        key: 'ville',
        required: false,
        type: 'string',
      },
      {
        header: 'Pays',
        key: 'pays',
        required: false,
        type: 'string',
        defaultValue: 'Côte d\'Ivoire',
      },
      {
        header: 'Code Postal',
        key: 'codePostal',
        required: false,
        type: 'string',
      },
      {
        header: 'Numero Fiscal',
        key: 'numeroFiscal',
        required: false,
        type: 'string',
      },
      {
        header: 'Site Web',
        key: 'siteWeb',
        required: false,
        type: 'string',
      },
      {
        header: 'Contact Principal',
        key: 'contactPrincipal',
        required: false,
        type: 'string',
      },
      {
        header: 'Delai Livraison',
        key: 'delaiLivraisonJours',
        required: false,
        type: 'number',
        defaultValue: 7,
        validate: (value) => {
          if (value < 0) return 'Le délai de livraison ne peut pas être négatif';
          return true;
        },
      },
      {
        header: 'Conditions Paiement',
        key: 'conditionsPaiement',
        required: false,
        type: 'string',
      },
      {
        header: 'Notes',
        key: 'notes',
        required: false,
        type: 'string',
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
   * Importer des fournisseurs depuis un fichier
   */
  async import(
    file: Express.Multer.File,
    options: ImportFournisseursOptions = {},
  ): Promise<ImportFournisseursResult> {
    const { mode = 'upsert', skipErrors = false, uniqueKey = 'email' } = options;

    this.logger.log(`Début import fournisseurs - Mode: ${mode}, Clé unique: ${uniqueKey}`);

    // Parser le fichier
    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 2000,
    });

    if (parseResult.errors.length > 0 && !skipErrors) {
      return {
        ...parseResult,
        summary: { created: 0, updated: 0, skipped: parseResult.errorRows },
      };
    }

    // Récupérer les fournisseurs existants selon la clé unique
    const existingFournisseurs = await this.getExistingFournisseurs(parseResult.data, uniqueKey);

    // Compteur pour générer les codes
    let codeCounter = await this.getNextCodeCounter();

    // Importer les fournisseurs
    const summary = { created: 0, updated: 0, skipped: 0 };
    const errors = [...parseResult.errors];

    for (const fournisseurData of parseResult.data) {
      try {
        const uniqueValue = this.getUniqueValue(fournisseurData, uniqueKey);
        const existingFournisseur = uniqueValue 
          ? existingFournisseurs.get(uniqueValue.toLowerCase()) 
          : null;

        // Vérifier le mode
        if (mode === 'create' && existingFournisseur) {
          summary.skipped++;
          continue;
        }
        if (mode === 'update' && !existingFournisseur) {
          summary.skipped++;
          continue;
        }

        // Générer un code si non fourni
        let code = fournisseurData.code;
        if (!code && !existingFournisseur) {
          code = `FRN-${String(codeCounter++).padStart(4, '0')}`;
        }

        // Préparer les données
        const data = {
          nom: fournisseurData.nom,
          email: fournisseurData.email || null,
          telephone: fournisseurData.telephone || null,
          adresse: fournisseurData.adresse || null,
          ville: fournisseurData.ville || null,
          pays: fournisseurData.pays || 'Côte d\'Ivoire',
          numeroFiscal: fournisseurData.numeroFiscal || null,
          siteWeb: fournisseurData.siteWeb || null,
          contactPrincipal: fournisseurData.contactPrincipal || null,
          delaiLivraisonJours: fournisseurData.delaiLivraisonJours || 7,
          conditionsPaiement: fournisseurData.conditionsPaiement || null,
          notes: fournisseurData.notes || null,
          estActif: fournisseurData.estActif !== false,
        };

        if (existingFournisseur) {
          // Mise à jour
          await this.prisma.fournisseur.update({
            where: { id: existingFournisseur.id },
            data,
          });
          summary.updated++;
        } else {
          // Vérifier unicité du code
          if (code) {
            const codeExists = await this.prisma.fournisseur.findFirst({
              where: { code },
            });
            if (codeExists) {
              code = `FRN-${String(codeCounter++).padStart(4, '0')}`;
            }
          }

          // Création
          await this.prisma.fournisseur.create({ 
            data: { ...data, code: code || `FRN-${String(codeCounter++).padStart(4, '0')}` },
          });
          summary.created++;
        }
      } catch (error) {
        this.logger.error(`Erreur import fournisseur ${fournisseurData.nom}: ${error.message}`);
        
        if (!skipErrors) {
          errors.push({
            row: parseResult.data.indexOf(fournisseurData) + 2,
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
      maxRows: 10,
    });

    return {
      preview: parseResult.data.slice(0, 5),
      totalRows: parseResult.totalRows,
      validRows: parseResult.importedRows,
      errorRows: parseResult.errorRows,
      errors: parseResult.errors.slice(0, 10),
      isValid: parseResult.errors.length === 0,
    };
  }

  /**
   * Générer un modèle de fichier d'import
   */
  async getTemplate(format: 'csv' | 'xlsx' = 'xlsx'): Promise<Buffer> {
    const exampleData = [
      {
        code: 'FRN-0001',
        nom: 'Fournisseur Tech SA',
        email: 'commandes@techsa.ci',
        telephone: '+22521234567',
        adresse: '10 Zone Industrielle',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI123456789',
        siteWeb: 'www.techsa.ci',
        contactPrincipal: 'M. Konan',
        delaiLivraisonJours: 5,
        conditionsPaiement: 'Net 30',
        estActif: true,
      },
      {
        code: 'FRN-0002',
        nom: 'Import Export Plus',
        email: 'contact@iep.ci',
        telephone: '+22527654321',
        adresse: '25 Rue du Port',
        ville: 'San Pedro',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI987654321',
        siteWeb: 'www.iep.ci',
        contactPrincipal: 'Mme Bamba',
        delaiLivraisonJours: 10,
        conditionsPaiement: 'Net 60',
        estActif: true,
      },
    ];

    return this.importService.generateTemplate(this.getColumns(), format, exampleData);
  }

  /**
   * Récupérer les fournisseurs existants selon la clé unique
   */
    private async getExistingFournisseurs(
        data: any[],
        uniqueKey: string,
      ): Promise<Map<string, { id: number }>> {
        // CORRECTION 1 : Le prédicat ": v is string" garantit à TS que le tableau final est string[]
        const values = data
          .map((d) => this.getUniqueValue(d, uniqueKey))
          .filter((v): v is string => v !== null && v !== ''); 

        if (values.length === 0) {
          return new Map();
        }

        let fournisseurs: any[] = []; // Initialisation vide par sécurité

        switch (uniqueKey) {
          case 'email':
            fournisseurs = await this.prisma.fournisseur.findMany({
              where: { email: { in: values } }, // values est maintenant string[] pur
              select: { id: true, email: true },
            });
            break;
          case 'code':
            // CORRECTION : cast 'as any' si le champ code n'est pas encore dans votre Prisma généré
            // Si vous avez mis à jour schema.prisma, retirez le 'as any'
            fournisseurs = await this.prisma.fournisseur.findMany({
              where: { code: { in: values.map(v => v.toUpperCase()) } } as any,
              select: { id: true, code: true } as any,
            });
            break;
          case 'nom':
            fournisseurs = await this.prisma.fournisseur.findMany({
              where: { nom: { in: values } },
              select: { id: true, nom: true },
            });
            break;
          default:
            return new Map();
        }

        const map = new Map<string, { id: number }>();
        
        fournisseurs.forEach((f) => {
        // Sécurisation de l'accès à la clé dynamique
          const val = f[uniqueKey];
          const key = (val ? String(val) : '').toLowerCase();
          if (key) {
            map.set(key, { id: f.id });
          }
        });

        return map;
      }

  /**
   * Obtenir la valeur de la clé unique
   */
  private getUniqueValue(data: any, uniqueKey: string): string | null {
    const value = data[uniqueKey];
    return value ? String(value).trim() : null;
  }

  /**
   * Obtenir le prochain compteur de code
   */
    private async getNextCodeCounter(): Promise<number> {
        // Utilisation de 'as any' pour contourner l'erreur si 'code' manque dans le type généré
        const lastFournisseur = await this.prisma.fournisseur.findFirst({
          where: {
            code: { startsWith: 'FRN-' },
          } as any, 
          orderBy: { code: 'desc' } as any,
          select: { code: true } as any,
        });

        // On cast le résultat car TS pense que lastFournisseur ne contient pas code
        const result = lastFournisseur as unknown as { code: string } | null;

        if (result?.code) {
          const match = result.code.match(/FRN-(\d+)/);
          if (match) {
            return parseInt(match[1], 10) + 1;
          }
        }

        return 1;
   }
}