// ============================================
// FICHIER: src/common/services/import.service.ts
// Service d'import réutilisable (CSV, XLSX)
// ============================================

import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import csv from 'csv-parser';
import { Readable } from 'stream';

export interface ImportColumn {
  /** Nom de la colonne dans le fichier */
  header: string;
  /** Clé de la propriété dans l'objet */
  key: string;
  /** Est-ce que la colonne est obligatoire */
  required?: boolean;
  /** Type de données attendu */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'email';
  /** Valeur par défaut si vide */
  defaultValue?: any;
  /** Fonction de transformation personnalisée */
  transform?: (value: any) => any;
  /** Fonction de validation personnalisée */
  validate?: (value: any) => boolean | string;
}

export interface ImportResult<T = any> {
  success: boolean;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  errors: ImportError[];
  data: T[];
  warnings: string[];
}

export interface ImportError {
  row: number;
  column?: string;
  value?: any;
  message: string;
}

export interface ImportOptions {
  columns: ImportColumn[];
  skipEmptyRows?: boolean;
  maxRows?: number;
  validateRow?: (row: any, rowIndex: number) => boolean | string;
}

@Injectable()
export class ImportService {
  /**
   * Parser un fichier CSV ou Excel
   */
  async parseFile(
    file: Express.Multer.File,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const extension = this.getFileExtension(file.originalname);

    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      throw new BadRequestException(
        `Format de fichier non supporté: ${extension}. Formats acceptés: CSV, XLSX`,
      );
    }

    if (extension === 'csv') {
      return this.parseCsv(file.buffer, options);
    } else {
      return this.parseExcel(file.buffer, options);
    }
  }

  /**
   * Parser un fichier CSV
   */
  private async parseCsv(
    buffer: Buffer,
    options: ImportOptions,
  ): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: ImportError[] = [];
      const warnings: string[] = [];
      let rowIndex = 0;

      const stream = Readable.from(buffer.toString('utf-8'));

      stream
        .pipe(
          csv({
            separator: this.detectSeparator(buffer.toString('utf-8')),
            mapHeaders: ({ header }) => header.trim().toLowerCase(),
          }),
        )
        .on('data', (row) => {
          rowIndex++;

          // Vérifier la limite de lignes
          if (options.maxRows && rowIndex > options.maxRows) {
            warnings.push(`Import limité aux ${options.maxRows} premières lignes`);
            return;
          }

          // Ignorer les lignes vides
          if (options.skipEmptyRows !== false && this.isEmptyRow(row)) {
            return;
          }

          // Mapper et valider la ligne
          const { data, rowErrors } = this.processRow(row, rowIndex, options);

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          } else {
            results.push(data);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            totalRows: rowIndex,
            importedRows: results.length,
            errorRows: errors.length,
            errors,
            data: results,
            warnings,
          });
        })
        .on('error', (error) => {
          reject(new BadRequestException(`Erreur de lecture CSV: ${error.message}`));
        });
    });
  }

  /**
   * Parser un fichier Excel
   */
  private async parseExcel(
    buffer: Buffer,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Le fichier Excel ne contient aucune feuille');
    }

    const results: any[] = [];
    const errors: ImportError[] = [];
    const warnings: string[] = [];

    // Récupérer les en-têtes (première ligne)
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim().toLowerCase();
    });

    // Valider que toutes les colonnes requises sont présentes
    const missingColumns = this.validateHeaders(headers, options.columns);
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Colonnes manquantes dans le fichier: ${missingColumns.join(', ')}`,
      );
    }

    // Parcourir les lignes de données
    let rowIndex = 0;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Ignorer l'en-tête

      rowIndex++;

      // Vérifier la limite de lignes
      if (options.maxRows && rowIndex > options.maxRows) {
        if (rowIndex === options.maxRows + 1) {
          warnings.push(`Import limité aux ${options.maxRows} premières lignes`);
        }
        return;
      }

      // Construire l'objet de la ligne
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = this.getCellValue(cell);
        }
      });

      // Ignorer les lignes vides
      if (options.skipEmptyRows !== false && this.isEmptyRow(rowData)) {
        return;
      }

      // Mapper et valider la ligne
      const { data, rowErrors } = this.processRow(rowData, rowNumber, options);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        results.push(data);
      }
    });

    return {
      success: errors.length === 0,
      totalRows: rowIndex,
      importedRows: results.length,
      errorRows: errors.length,
      errors,
      data: results,
      warnings,
    };
  }

  /**
   * Traiter une ligne et la valider
   */
  private processRow(
    row: Record<string, any>,
    rowIndex: number,
    options: ImportOptions,
  ): { data: any; rowErrors: ImportError[] } {
    const data: Record<string, any> = {};
    const rowErrors: ImportError[] = [];

    for (const column of options.columns) {
      // Chercher la valeur dans la ligne (insensible à la casse)
      const headerKey = column.header.toLowerCase();
      let value = row[headerKey];

      // Appliquer la valeur par défaut si vide
      if (value === undefined || value === null || value === '') {
        if (column.defaultValue !== undefined) {
          value = column.defaultValue;
        } else if (column.required) {
          rowErrors.push({
            row: rowIndex,
            column: column.header,
            value,
            message: `La colonne "${column.header}" est obligatoire`,
          });
          continue;
        } else {
          data[column.key] = null;
          continue;
        }
      }

      // Transformer la valeur selon le type
      try {
        value = this.transformValue(value, column.type);
      } catch (error) {
        rowErrors.push({
          row: rowIndex,
          column: column.header,
          value,
          message: `Valeur invalide pour "${column.header}": ${error.message}`,
        });
        continue;
      }

      // Appliquer la transformation personnalisée
      if (column.transform) {
        try {
          value = column.transform(value);
        } catch (error) {
          rowErrors.push({
            row: rowIndex,
            column: column.header,
            value,
            message: `Erreur de transformation pour "${column.header}": ${error.message}`,
          });
          continue;
        }
      }

      // Validation personnalisée
      if (column.validate) {
        const validationResult = column.validate(value);
        if (validationResult !== true) {
          rowErrors.push({
            row: rowIndex,
            column: column.header,
            value,
            message: typeof validationResult === 'string'
              ? validationResult
              : `Valeur invalide pour "${column.header}"`,
          });
          continue;
        }
      }

      data[column.key] = value;
    }

    // Validation globale de la ligne
    if (options.validateRow && rowErrors.length === 0) {
      const rowValidation = options.validateRow(data, rowIndex);
      if (rowValidation !== true) {
        rowErrors.push({
          row: rowIndex,
          message: typeof rowValidation === 'string'
            ? rowValidation
            : 'Ligne invalide',
        });
      }
    }

    return { data, rowErrors };
  }

  /**
   * Transformer une valeur selon son type
   */
  private transformValue(value: any, type?: string): any {
    if (value === null || value === undefined) return null;

    switch (type) {
      case 'number':
        const num = Number(String(value).replace(/[^\d.-]/g, ''));
        if (isNaN(num)) {
          throw new Error('Nombre invalide');
        }
        return num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        const strValue = String(value).toLowerCase().trim();
        if (['true', 'oui', 'yes', '1', 'vrai'].includes(strValue)) return true;
        if (['false', 'non', 'no', '0', 'faux'].includes(strValue)) return false;
        throw new Error('Booléen invalide');

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Date invalide');
        }
        return date;

      case 'email':
        const email = String(value).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error('Email invalide');
        }
        return email;

      case 'string':
      default:
        return String(value).trim();
    }
  }

  /**
   * Obtenir la valeur d'une cellule Excel
   */
  private getCellValue(cell: ExcelJS.Cell): any {
    if (cell.value === null || cell.value === undefined) return null;

    // Gérer les différents types de valeurs Excel
    if (typeof cell.value === 'object') {
      if ('richText' in cell.value) {
        // Texte enrichi
        return cell.value.richText.map((rt: any) => rt.text).join('');
      }
      if ('text' in cell.value) {
        // Hyperlien
        return cell.value.text;
      }
      if ('result' in cell.value) {
        // Formule
        return cell.value.result;
      }
      if (cell.value instanceof Date) {
        return cell.value;
      }
    }

    return cell.value;
  }

  /**
   * Détecter le séparateur CSV
   */
  private detectSeparator(content: string): string {
    const firstLine = content.split('\n')[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
    if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
    return ',';
  }

  /**
   * Vérifier si une ligne est vide
   */
  private isEmptyRow(row: Record<string, any>): boolean {
    return Object.values(row).every(
      (v) => v === null || v === undefined || v === '',
    );
  }

  /**
   * Valider les en-têtes du fichier
   */
  private validateHeaders(
    headers: string[],
    columns: ImportColumn[],
  ): string[] {
    const normalizedHeaders = headers.map((h) => h?.toLowerCase());
    const missingColumns: string[] = [];

    for (const column of columns) {
      if (column.required) {
        const headerKey = column.header.toLowerCase();
        if (!normalizedHeaders.includes(headerKey)) {
          missingColumns.push(column.header);
        }
      }
    }

    return missingColumns;
  }

  /**
   * Obtenir l'extension du fichier
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Générer un modèle de fichier d'import
   */
  async generateTemplate(
    columns: ImportColumn[],
    format: 'csv' | 'xlsx' = 'xlsx',
    exampleData?: any[],
  ): Promise<Buffer> {
    if (format === 'csv') {
      return this.generateCsvTemplate(columns, exampleData);
    }
    return this.generateExcelTemplate(columns, exampleData);
  }

  /**
   * Générer un modèle CSV
   */
  private async generateCsvTemplate(
    columns: ImportColumn[],
    exampleData?: any[],
  ): Promise<Buffer> {
    const headers = columns.map((c) => c.header);
    let content = headers.join(';') + '\n';

    if (exampleData && exampleData.length > 0) {
      for (const row of exampleData) {
        const values = columns.map((c) => row[c.key] ?? '');
        content += values.join(';') + '\n';
      }
    }

    return Buffer.from('\ufeff' + content, 'utf-8');
  }

  /**
   * Générer un modèle Excel
   */
  private async generateExcelTemplate(
    columns: ImportColumn[],
    exampleData?: any[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import');

    // En-têtes
    const headerRow = worksheet.addRow(columns.map((c) => c.header));
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2C3E50' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };

    // Largeur des colonnes
    columns.forEach((col, index) => {
      worksheet.getColumn(index + 1).width = 20;
    });

    // Données d'exemple
    if (exampleData && exampleData.length > 0) {
      for (const row of exampleData) {
        worksheet.addRow(columns.map((c) => row[c.key] ?? ''));
      }
    }

    // Ajouter une feuille d'instructions
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.addRow(['Instructions d\'import']);
    instructionsSheet.addRow([]);
    instructionsSheet.addRow(['Colonne', 'Obligatoire', 'Type', 'Description']);

    columns.forEach((col) => {
      instructionsSheet.addRow([
        col.header,
        col.required ? 'Oui' : 'Non',
        col.type || 'Texte',
        '',
      ]);
    });

    instructionsSheet.getColumn(1).width = 25;
    instructionsSheet.getColumn(2).width = 15;
    instructionsSheet.getColumn(3).width = 15;
    instructionsSheet.getColumn(4).width = 40;

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}