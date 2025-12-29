// ============================================
// FICHIER: src/common/services/export.service.ts
// Service d'export réutilisable (CSV, XLSX, PDF)
// ============================================

import { Injectable, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { createObjectCsvStringifier } from 'csv-writer';
import * as PDFDocument from 'pdfkit';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'currency' | 'percentage';
  format?: string;
}

export interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
  format: ExportFormat;
  metadata?: {
    generatedBy?: string;
    company?: string;
    dateRange?: { start?: Date; end?: Date };
  };
}

@Injectable()
export class ExportService {
  /**
   * Exporter les données dans le format demandé
   */
  async export(options: ExportOptions, res: Response): Promise<void> {
    const { format } = options;

    switch (format) {
      case 'csv':
        await this.exportCsv(options, res);
        break;
      case 'xlsx':
        await this.exportXlsx(options, res);
        break;
      case 'pdf':
        await this.exportPdf(options, res);
        break;
      default:
        throw new BadRequestException(
          `Format d'export non supporté: ${format}. Formats disponibles: csv, xlsx, pdf`,
        );
    }
  }

  /**
   * Export CSV
   */
  private async exportCsv(options: ExportOptions, res: Response): Promise<void> {
    const { filename, columns, data } = options;

    const csvStringifier = createObjectCsvStringifier({
      header: columns.map((col) => ({ id: col.key, title: col.header })),
    });

    // Formater les données
    const formattedData = data.map((row) => {
      const formattedRow: Record<string, any> = {};
      columns.forEach((col) => {
        formattedRow[col.key] = this.formatValue(row[col.key], col.type);
      });
      return formattedRow;
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(formattedData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.csv"`,
    );
    res.send('\ufeff' + csvContent); // BOM pour Excel
  }

  /**
   * Export Excel (XLSX)
   */
  private async exportXlsx(options: ExportOptions, res: Response): Promise<void> {
    const { filename, title, subtitle, columns, data, metadata } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = metadata?.generatedBy || 'Système de Gestion de Stock';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(title.substring(0, 31)); // Max 31 chars

    // === HEADER SECTION ===
    let currentRow = 1;

    // Titre principal
    worksheet.mergeCells(`A${currentRow}:${this.getColumnLetter(columns.length)}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: '2C3E50' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    // Sous-titre (si présent)
    if (subtitle) {
      worksheet.mergeCells(`A${currentRow}:${this.getColumnLetter(columns.length)}${currentRow}`);
      const subtitleCell = worksheet.getCell(`A${currentRow}`);
      subtitleCell.value = subtitle;
      subtitleCell.font = { italic: true, size: 11, color: { argb: '7F8C8D' } };
      subtitleCell.alignment = { horizontal: 'center' };
      currentRow++;
    }

    // Métadonnées
    if (metadata?.company) {
      worksheet.mergeCells(`A${currentRow}:${this.getColumnLetter(columns.length)}${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = `Entreprise: ${metadata.company}`;
      currentRow++;
    }

    // Date de génération
    worksheet.mergeCells(`A${currentRow}:${this.getColumnLetter(columns.length)}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Généré le: ${new Date().toLocaleString('fr-FR')}`;
    dateCell.font = { size: 10, color: { argb: '95A5A6' } };
    currentRow += 2; // Ligne vide avant les données

    // === COLONNES HEADER ===
    const headerRow = currentRow;
    columns.forEach((col, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2C3E50' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Largeur de colonne
      worksheet.getColumn(index + 1).width = col.width || 15;
    });
    worksheet.getRow(headerRow).height = 25;
    currentRow++;

    // === DONNÉES ===
    data.forEach((row, rowIndex) => {
      columns.forEach((col, colIndex) => {
        const cell = worksheet.getCell(currentRow, colIndex + 1);
        const value = this.getNestedValue(row, col.key);
        
        // Appliquer le format approprié
        cell.value = this.formatValueForExcel(value, col.type);
        
        // Style alterné pour les lignes
        if (rowIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F8F9FA' },
          };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'E0E0E0' } },
          left: { style: 'thin', color: { argb: 'E0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'E0E0E0' } },
          right: { style: 'thin', color: { argb: 'E0E0E0' } },
        };

        // Format numérique pour les devises
        if (col.type === 'currency') {
          cell.numFmt = '#,##0.00 "FCFA"';
        } else if (col.type === 'percentage') {
          cell.numFmt = '0.00%';
        } else if (col.type === 'number') {
          cell.numFmt = '#,##0';
        }
      });
      currentRow++;
    });

    // === PIED DE PAGE ===
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:${this.getColumnLetter(columns.length)}${currentRow}`);
    const footerCell = worksheet.getCell(`A${currentRow}`);
    footerCell.value = `Total: ${data.length} enregistrement(s)`;
    footerCell.font = { bold: true, size: 10 };

    // Envoyer le fichier
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Export PDF
   */
  private async exportPdf(options: ExportOptions, res: Response): Promise<void> {
    const { filename, title, subtitle, columns, data, metadata } = options;

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: columns.length > 5 ? 'landscape' : 'portrait',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.pdf"`,
    );

    doc.pipe(res);

    // === EN-TÊTE ===
    // Logo ou nom de l'entreprise
    doc.fontSize(20).fillColor('#2C3E50').text(title, { align: 'center' });
    doc.moveDown(0.5);

    if (subtitle) {
      doc.fontSize(12).fillColor('#7F8C8D').text(subtitle, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Informations de génération
    doc
      .fontSize(10)
      .fillColor('#95A5A6')
      .text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, { align: 'right' });
    
    if (metadata?.company) {
      doc.text(`Entreprise: ${metadata.company}`, { align: 'right' });
    }
    
    doc.moveDown(1);

    // === TABLEAU ===
    const tableTop = doc.y;
    const tableLeft = 40;
    const pageWidth = doc.page.width - 80;
    const colWidth = pageWidth / columns.length;
    const rowHeight = 25;

    // En-têtes du tableau
    doc.fillColor('#2C3E50').fontSize(9);
    
    // Fond de l'en-tête
    doc
      .rect(tableLeft, tableTop, pageWidth, rowHeight)
      .fill('#2C3E50');

    // Texte de l'en-tête
    doc.fillColor('#FFFFFF');
    columns.forEach((col, i) => {
      doc.text(
        col.header,
        tableLeft + i * colWidth + 5,
        tableTop + 8,
        { width: colWidth - 10, align: 'center' },
      );
    });

    // Lignes de données
    let yPosition = tableTop + rowHeight;
    doc.fillColor('#2C3E50').fontSize(8);

    data.forEach((row, rowIndex) => {
      // Nouvelle page si nécessaire
      if (yPosition > doc.page.height - 80) {
        doc.addPage();
        yPosition = 40;
        
        // Répéter l'en-tête sur la nouvelle page
        doc
          .rect(tableLeft, yPosition, pageWidth, rowHeight)
          .fill('#2C3E50');
        
        doc.fillColor('#FFFFFF').fontSize(9);
        columns.forEach((col, i) => {
          doc.text(
            col.header,
            tableLeft + i * colWidth + 5,
            yPosition + 8,
            { width: colWidth - 10, align: 'center' },
          );
        });
        
        yPosition += rowHeight;
        doc.fillColor('#2C3E50').fontSize(8);
      }

      // Fond alterné
      if (rowIndex % 2 === 0) {
        doc
          .rect(tableLeft, yPosition, pageWidth, rowHeight)
          .fill('#F8F9FA');
      }

      // Bordure
      doc
        .rect(tableLeft, yPosition, pageWidth, rowHeight)
        .stroke('#E0E0E0');

      // Données
      doc.fillColor('#2C3E50');
      columns.forEach((col, i) => {
        const value = this.getNestedValue(row, col.key);
        const formattedValue = this.formatValue(value, col.type);
        
        doc.text(
          String(formattedValue ?? '-'),
          tableLeft + i * colWidth + 5,
          yPosition + 8,
          { width: colWidth - 10, align: 'center' },
        );
      });

      yPosition += rowHeight;
    });

    // === PIED DE PAGE ===
    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor('#2C3E50')
      .text(`Total: ${data.length} enregistrement(s)`, { align: 'left' });

    // Numérotation des pages
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#95A5A6')
        .text(
          `Page ${i + 1} sur ${pages.count}`,
          40,
          doc.page.height - 30,
          { align: 'center' },
        );
    }

    doc.end();
  }

  // === UTILITAIRES ===

  /**
   * Obtenir une valeur imbriquée (ex: "client.nom")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Formater une valeur pour l'affichage
   */
  private formatValue(value: any, type?: string): string | number {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'date':
        return new Date(value).toLocaleDateString('fr-FR');
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XOF',
        }).format(Number(value));
      case 'percentage':
        return `${(Number(value) * 100).toFixed(2)}%`;
      case 'number':
        return new Intl.NumberFormat('fr-FR').format(Number(value));
      default:
        return String(value);
    }
  }

  /**
   * Formater une valeur pour Excel (garder le type)
   */
  private formatValueForExcel(value: any, type?: string): any {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'date':
        return new Date(value);
      case 'currency':
      case 'number':
      case 'percentage':
        return Number(value) || 0;
      default:
        return value;
    }
  }

  /**
   * Convertir un index en lettre de colonne Excel
   */
  private getColumnLetter(index: number): string {
    let letter = '';
    while (index > 0) {
      const remainder = (index - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      index = Math.floor((index - 1) / 26);
    }
    return letter || 'A';
  }
}