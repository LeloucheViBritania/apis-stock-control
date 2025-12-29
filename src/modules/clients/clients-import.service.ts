// ============================================
// FICHIER: src/modules/clients/clients-import.service.ts
// Service d'import spécialisé pour les clients
// ============================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportService, ImportColumn, ImportResult } from '../../common/services/import.service';

export interface ImportClientsOptions {
  /** Mode d'import: 'create' = création seule, 'update' = mise à jour seule, 'upsert' = les deux */
  mode?: 'create' | 'update' | 'upsert';
  /** Ignorer les erreurs et continuer l'import */
  skipErrors?: boolean;
  /** Clé unique pour détecter les doublons: 'email' ou 'telephone' */
  uniqueKey?: 'email' | 'telephone' | 'nom';
}

export interface ImportClientsResult extends ImportResult {
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

@Injectable()
export class ClientsImportService {
  private readonly logger = new Logger(ClientsImportService.name);

  constructor(
    private prisma: PrismaService,
    private importService: ImportService,
  ) {}

  /**
   * Colonnes attendues pour l'import des clients
   */
  getColumns(): ImportColumn[] {
    return [
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
          // Nettoyer le numéro de téléphone
          return String(value).replace(/[^\d+]/g, '');
        },
        validate: (value) => {
          if (value && value.length < 8) {
            return 'Le numéro de téléphone doit contenir au moins 8 chiffres';
          }
          return true;
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
   * Importer des clients depuis un fichier
   */
  async import(
    file: Express.Multer.File,
    options: ImportClientsOptions = {},
  ): Promise<ImportClientsResult> {
    const { mode = 'upsert', skipErrors = false, uniqueKey = 'email' } = options;

    this.logger.log(`Début import clients - Mode: ${mode}, Clé unique: ${uniqueKey}`);

    // Parser le fichier
    const parseResult = await this.importService.parseFile(file, {
      columns: this.getColumns(),
      skipEmptyRows: true,
      maxRows: 5000,
    });

    if (parseResult.errors.length > 0 && !skipErrors) {
      return {
        ...parseResult,
        summary: { created: 0, updated: 0, skipped: parseResult.errorRows },
      };
    }

    // Récupérer les clients existants selon la clé unique
    const existingClients = await this.getExistingClients(parseResult.data, uniqueKey);

    // Importer les clients
    const summary = { created: 0, updated: 0, skipped: 0 };
    const errors = [...parseResult.errors];

    for (const clientData of parseResult.data) {
      try {
        const uniqueValue = this.getUniqueValue(clientData, uniqueKey);
        const existingClient = uniqueValue ? existingClients.get(uniqueValue.toLowerCase()) : null;

        // Vérifier le mode
        if (mode === 'create' && existingClient) {
          summary.skipped++;
          continue;
        }
        if (mode === 'update' && !existingClient) {
          summary.skipped++;
          continue;
        }

        // Vérifier si on a une clé unique pour l'upsert
        if (mode === 'upsert' && !uniqueValue && !existingClient) {
          // Création sans clé unique - OK
        } else if (mode === 'upsert' && !uniqueValue && existingClient) {
          summary.skipped++;
          continue;
        }

        // Préparer les données
        const data = {
          nom: clientData.nom,
          email: clientData.email || null,
          telephone: clientData.telephone || null,
          adresse: clientData.adresse || null,
          ville: clientData.ville || null,
          pays: clientData.pays || 'Côte d\'Ivoire',
          numeroFiscal: clientData.numeroFiscal || null,
          estActif: clientData.estActif !== false,
        };

        if (existingClient) {
          // Mise à jour
          await this.prisma.client.update({
            where: { id: existingClient.id },
            data,
          });
          summary.updated++;
        } else {
          // Vérifier les doublons potentiels
          if (data.email) {
            const emailExists = await this.prisma.client.findFirst({
              where: { email: data.email },
            });
            if (emailExists) {
              if (mode === 'create') {
                errors.push({
                  row: parseResult.data.indexOf(clientData) + 2,
                  column: 'Email',
                  value: data.email,
                  message: `Un client avec cet email existe déjà`,
                });
                continue;
              }
            }
          }

          // Création
          await this.prisma.client.create({ data });
          summary.created++;
        }
      } catch (error) {
        this.logger.error(`Erreur import client ${clientData.nom}: ${error.message}`);
        
        if (!skipErrors) {
          errors.push({
            row: parseResult.data.indexOf(clientData) + 2,
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
        nom: 'Société ABC',
        email: 'contact@abc.ci',
        telephone: '+22501234567',
        adresse: '123 Avenue de la République',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI123456789',
        estActif: true,
      },
      {
        nom: 'Entreprise XYZ',
        email: 'info@xyz.ci',
        telephone: '+22507654321',
        adresse: '45 Rue du Commerce',
        ville: 'Bouaké',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI987654321',
        estActif: true,
      },
    ];

    return this.importService.generateTemplate(this.getColumns(), format, exampleData);
  }

  /**
   * Récupérer les clients existants selon la clé unique
   */
  private async getExistingClients(
    data: any[],
    uniqueKey: string,
  ): Promise<Map<string, { id: number }>> {
    const values = data
      .map((d) => this.getUniqueValue(d, uniqueKey))
      .filter((v) => v);

    if (values.length === 0) {
      return new Map();
    }

    let clients: { id: number; email?: string; telephone?: string; nom?: string }[];

    // 1. CORRECTION ENTRÉE : On filtre pour garantir que ce sont des strings non-nulles
    // Le prédicat ": v is string" rassure TypeScript
    const safeValues = values.filter((v): v is string => typeof v === 'string' && v !== null && v !== '');

    // Si aucune valeur valide, on retourne vide tout de suite
    if (safeValues.length === 0) return new Map();

    switch (uniqueKey) {
    case 'email':
        const rawEmails = await this.prisma.client.findMany({
        where: { email: { in: safeValues } }, // Ici safeValues est string[] pur
        select: { id: true, email: true },
        });

        // 2. CORRECTION SORTIE : On mappe pour transformer null en undefined
        clients = rawEmails.map(c => ({
        id: c.id,
        email: c.email ?? undefined, // Convertit null -> undefined
        // On doit s'assurer que les autres propriétés optionnelles de 'clients' sont gérées si nécessaire
        // ou on caste si la structure de 'clients' est partielle
        })) as any; // 'as any' est parfois nécessaire si 'clients' a d'autres champs obligatoires manquants
        break;

    case 'telephone':
        const rawPhones = await this.prisma.client.findMany({
        where: { telephone: { in: safeValues } },
        select: { id: true, telephone: true },
        });

        clients = rawPhones.map(c => ({
        id: c.id,
        telephone: c.telephone ?? undefined,
        })) as any;
        break;

    case 'nom':
        const rawNames = await this.prisma.client.findMany({
        where: { nom: { in: safeValues } },
        select: { id: true, nom: true },
        });

        // Le nom est souvent obligatoire (string), mais s'il est nullable :
        clients = rawNames.map(c => ({
        id: c.id,
        nom: c.nom, 
        })) as any;
        break;

    default:
        return new Map();
    }

    const map = new Map<string, { id: number }>();
    clients.forEach((client) => {
      const key = (client[uniqueKey] || '').toLowerCase();
      if (key) {
        map.set(key, { id: client.id });
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
}