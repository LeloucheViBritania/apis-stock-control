// ============================================
// FICHIER: src/modules/rapports/rapports.controller.ts
// Controller Rapports avec routes d'export
// ============================================

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RapportsExportService } from './rapports-export.service';
import { ExportRapportInventaireQueryDto, ExportFormat } from '../../common/dto/export-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('📊 Rapports')
@ApiBearerAuth('JWT-auth')
@Controller('rapports')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
export class RapportsController {
  constructor(private readonly rapportsExportService: RapportsExportService) {}

  // ============================================
  // INVENTAIRE VALORISÉ
  // ============================================

  @Get('inventaire-valorise/export')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @PremiumFeature(Feature.RAPPORTS_AVANCES)
  @ApiOperation({
    summary: 'Exporter le rapport d\'inventaire valorisé',
    description: `
      Génère un rapport complet de l'inventaire avec valorisation.
      
      **Fonctionnalité:** PREMIUM
      
      **Informations incluses:**
      - Liste complète des produits en stock
      - Quantités totales, réservées et disponibles
      - Valorisation au coût et au prix de vente
      - Marge potentielle par produit
      - Répartition par entrepôt
      
      **Formats disponibles:**
      - CSV: Import facile dans Excel/Google Sheets
      - XLSX: Fichier Excel formaté avec styles
      - PDF: Document prêt à imprimer
      
      **Utilité:**
      - Bilan comptable
      - Audit financier
      - Analyse de rentabilité
      - Reporting direction
    `,
  })
  @ApiQuery({
    name: 'format',
    enum: ExportFormat,
    required: true,
    description: 'Format d\'export souhaité',
    example: 'xlsx',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiQuery({
    name: 'categorieId',
    required: false,
    type: Number,
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'methodeValorisation',
    required: false,
    enum: ['FIFO', 'LIFO', 'CMP'],
    description: 'Méthode de valorisation (par défaut: CMP)',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({
    status: 200,
    description: 'Fichier exporté avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Format d\'export non supporté',
  })
  @ApiResponse({
    status: 403,
    description: 'Abonnement Premium requis',
  })
  async exportInventaireValorise(
    @Query() query: ExportRapportInventaireQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.rapportsExportService.exportInventaireValorise(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  // ============================================
  // INVENTAIRE PAR CATÉGORIE
  // ============================================

  @Get('inventaire-par-categorie/export')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @PremiumFeature(Feature.RAPPORTS_AVANCES)
  @ApiOperation({
    summary: 'Exporter l\'inventaire groupé par catégorie',
    description: `
      Génère un rapport de l'inventaire valorisé groupé par catégorie.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Informations incluses:**
      - Résumé par catégorie
      - Valeur totale par catégorie
      - Marge potentielle
      - Part de chaque catégorie dans le stock total
      
      **Utilité:**
      - Analyse du mix produit
      - Optimisation des achats
      - Reporting stratégique
    `,
  })
  @ApiQuery({
    name: 'format',
    enum: ExportFormat,
    required: true,
    description: 'Format d\'export souhaité',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({
    status: 200,
    description: 'Fichier exporté avec succès',
  })
  async exportInventaireParCategorie(
    @Query() query: ExportRapportInventaireQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.rapportsExportService.exportInventaireParCategorie(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  // ============================================
  // ANALYSE ABC
  // ============================================

  @Get('analyse-abc/export')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @PremiumFeature(Feature.RAPPORTS_AVANCES)
  @ApiOperation({
    summary: 'Exporter l\'analyse ABC de l\'inventaire',
    description: `
      Génère une analyse ABC (Pareto) de l'inventaire.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Classification:**
      - **Classe A:** ~20% des produits représentant 80% de la valeur
      - **Classe B:** ~30% des produits représentant 15% de la valeur
      - **Classe C:** ~50% des produits représentant 5% de la valeur
      
      **Utilité:**
      - Prioriser la gestion des stocks critiques
      - Optimiser les investissements
      - Réduire les ruptures sur produits stratégiques
    `,
  })
  @ApiQuery({
    name: 'format',
    enum: ExportFormat,
    required: true,
    description: 'Format d\'export souhaité',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiQuery({
    name: 'categorieId',
    required: false,
    type: Number,
    description: 'Filtrer par catégorie',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({
    status: 200,
    description: 'Fichier exporté avec succès',
  })
  async exportAnalyseABC(
    @Query() query: ExportRapportInventaireQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.rapportsExportService.exportAnalyseABC(
      query,
      query.format as ExportFormat,
      res,
    );
  }
}