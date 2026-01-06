// ============================================
// FICHIER: src/modules/inventaire-physique/inventaire-physique.controller.ts
// Controller pour la gestion des inventaires physiques
// ============================================

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { InventairePhysiqueService } from './inventaire-physique.service';
import {
  CreateSessionInventaireDto,
  ScannerProduitDto,
  ScannerCodeBarreDto,
  ComptageEnMasseDto,
  RecompterProduitDto,
  ValiderInventaireDto,
  AnnulerInventaireDto,
  FiltresSessionsDto,
  StatutInventairePhysique,
} from './dto/inventaire-physique.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('📦 Inventaire Physique')
@ApiBearerAuth('JWT-auth')
@Controller('inventaire-physique')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
@PremiumFeature(Feature.INVENTAIRE_PHYSIQUE)
export class InventairePhysiqueController {
  constructor(
    private readonly inventairePhysiqueService: InventairePhysiqueService,
  ) {}

  // ============================================
  // CRÉER UNE SESSION
  // ============================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Démarrer une session d\'inventaire physique',
    description: `
      Crée une nouvelle session d'inventaire physique pour un entrepôt.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Options de périmètre:**
      - Inventaire complet d'un entrepôt
      - Inventaire par catégorie
      - Inventaire par zone d'emplacement
      - Inventaire de produits spécifiques
      
      **Règles:**
      - Une seule session active par entrepôt
      - Les quantités théoriques sont figées au démarrage
      - Génère automatiquement une référence unique
    `,
  })
  @ApiBody({ type: CreateSessionInventaireDto })
  @ApiResponse({
    status: 201,
    description: 'Session créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou aucun produit à inventorier',
  })
  @ApiResponse({
    status: 409,
    description: 'Une session est déjà en cours pour cet entrepôt',
  })
  async creerSession(
    @Body() dto: CreateSessionInventaireDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.creerSession(dto, req.user.id);
  }

  // ============================================
  // LISTER LES SESSIONS
  // ============================================

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lister les sessions d\'inventaire',
    description: 'Retourne la liste paginée des sessions avec filtres optionnels.',
  })
  @ApiQuery({ name: 'statut', enum: StatutInventairePhysique, required: false })
  @ApiQuery({ name: 'entrepotId', type: Number, required: false })
  @ApiQuery({ name: 'dateDebut', type: String, required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'dateFin', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste des sessions' })
  async listerSessions(@Query() filtres: FiltresSessionsDto) {
    return this.inventairePhysiqueService.listerSessions(filtres);
  }

  // ============================================
  // DÉTAILS D'UNE SESSION
  // ============================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtenir les détails d\'une session',
    description: `
      Retourne les informations complètes d'une session d'inventaire:
      - Métadonnées de la session
      - Liste des produits à compter
      - Statistiques de progression
      - État des comptages
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session', example: 1 })
  @ApiResponse({ status: 200, description: 'Détails de la session' })
  @ApiResponse({ status: 404, description: 'Session non trouvée' })
  async getSessionDetails(@Param('id', ParseIntPipe) id: number) {
    return this.inventairePhysiqueService.getSessionDetails(id);
  }

  // ============================================
  // SCANNER/COMPTER UN PRODUIT
  // ============================================

  @Post(':id/scanner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enregistrer un comptage (par ID produit)',
    description: `
      Enregistre la quantité physique comptée pour un produit.
      
      **Comportement:**
      - Calcule automatiquement l'écart avec le stock théorique
      - Signale si un recomptage est nécessaire (écart > 10%)
      - Met à jour les statistiques de la session
      
      **Statuts de ligne:**
      - EN_ATTENTE: Non encore compté
      - COMPTE: Compté avec écart acceptable
      - ECART: Nécessite un recomptage
      - VALIDE: Aucun écart ou recomptage effectué
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: ScannerProduitDto })
  @ApiResponse({ status: 200, description: 'Comptage enregistré' })
  @ApiResponse({ status: 400, description: 'Session inactive ou produit invalide' })
  @ApiResponse({ status: 404, description: 'Session ou produit non trouvé' })
  async scannerProduit(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: ScannerProduitDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.scannerProduit(sessionId, dto, req.user.id);
  }

  // ============================================
  // SCANNER PAR CODE-BARRE
  // ============================================

  @Post(':id/scanner-code-barre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enregistrer un comptage (par code-barre)',
    description: `
      Recherche le produit par code-barre ou référence, puis enregistre le comptage.
      Idéal pour l'utilisation avec un lecteur de code-barres.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: ScannerCodeBarreDto })
  @ApiResponse({ status: 200, description: 'Comptage enregistré' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé avec ce code-barre' })
  async scannerCodeBarre(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: ScannerCodeBarreDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.scannerCodeBarre(sessionId, dto, req.user.id);
  }

  // ============================================
  // COMPTAGE EN MASSE
  // ============================================

  @Post(':id/comptage-masse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enregistrer plusieurs comptages en une fois',
    description: `
      Permet d'enregistrer plusieurs comptages simultanément.
      Utile pour l'import depuis un fichier ou une saisie groupée.
      
      Les erreurs sur certaines lignes n'empêchent pas le traitement des autres.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: ComptageEnMasseDto })
  @ApiResponse({
    status: 200,
    description: 'Résultat du comptage en masse',
    schema: {
      example: {
        total: 50,
        success: 48,
        errors: 2,
        details: [
          { produitId: 5, message: 'Produit non trouvé dans la session' },
        ],
      },
    },
  })
  async comptageEnMasse(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: ComptageEnMasseDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.comptageEnMasse(sessionId, dto, req.user.id);
  }

  // ============================================
  // RECOMPTER UN PRODUIT
  // ============================================

  @Post(':id/recompter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recompter un produit',
    description: `
      Enregistre un recomptage pour un produit avec un écart important.
      Le recomptage remplace la valeur du premier comptage pour le calcul de l'écart final.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: RecompterProduitDto })
  @ApiResponse({ status: 200, description: 'Recomptage enregistré' })
  async recompterProduit(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: RecompterProduitDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.recompterProduit(sessionId, dto, req.user.id);
  }

  // ============================================
  // VOIR LES ÉCARTS
  // ============================================

  @Get(':id/ecarts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Voir les écarts de l\'inventaire',
    description: `
      Affiche le détail des écarts entre stock théorique et physique:
      - Liste des produits avec écart (positif ou négatif)
      - Valorisation des écarts
      - Résumé par catégorie
      
      Permet d'analyser les différences avant validation.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiResponse({
    status: 200,
    description: 'Détail des écarts',
    schema: {
      example: {
        sessionId: 1,
        reference: 'INV-202501-0001',
        totalLignes: 100,
        lignesAvecEcart: 12,
        ecartPositifTotal: 45,
        ecartNegatifTotal: 23,
        valeurEcartPositif: 125000,
        valeurEcartNegatif: 89000,
        valeurEcartNet: 36000,
        lignes: [],
        resumeParCategorie: [],
      },
    },
  })
  async getEcarts(@Param('id', ParseIntPipe) sessionId: number) {
    return this.inventairePhysiqueService.getEcarts(sessionId);
  }

  // ============================================
  // VALIDER L'INVENTAIRE
  // ============================================

  @Post(':id/valider')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Valider et appliquer l\'inventaire',
    description: `
      Valide la session d'inventaire et applique les ajustements de stock.
      
      **Prérequis:**
      - Tous les produits doivent être comptés
      - Les produits nécessitant un recomptage doivent être traités
      
      **Actions:**
      - Met à jour les quantités en stock
      - Crée des mouvements d'ajustement
      - Clôture la session
      
      **Options:**
      - Possibilité d'exclure certaines lignes de la validation
      - Possibilité de ne pas appliquer les ajustements (mode simulation)
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: ValiderInventaireDto })
  @ApiResponse({ status: 200, description: 'Inventaire validé' })
  @ApiResponse({
    status: 400,
    description: 'Produits non comptés ou recomptages en attente',
  })
  async validerInventaire(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: ValiderInventaireDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.validerInventaire(sessionId, dto, req.user.id);
  }

  // ============================================
  // ANNULER L'INVENTAIRE
  // ============================================

  @Post(':id/annuler')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Annuler la session d\'inventaire',
    description: `
      Annule une session d'inventaire en cours.
      
      **Important:**
      - Impossible d'annuler une session déjà validée
      - Les comptages effectués sont conservés dans l'historique
      - Aucun ajustement de stock n'est appliqué
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiBody({ type: AnnulerInventaireDto })
  @ApiResponse({ status: 200, description: 'Session annulée' })
  @ApiResponse({ status: 400, description: 'Session déjà validée ou annulée' })
  async annulerInventaire(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: AnnulerInventaireDto,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.annulerInventaire(sessionId, dto, req.user.id);
  }

  // ============================================
  // METTRE EN PAUSE
  // ============================================

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre la session en pause',
    description: 'Suspend temporairement la session. Les comptages ne sont plus possibles.',
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiResponse({ status: 200, description: 'Session mise en pause' })
  async mettreEnPause(
    @Param('id', ParseIntPipe) sessionId: number,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.mettreEnPause(sessionId, req.user.id);
  }

  // ============================================
  // REPRENDRE
  // ============================================

  @Post(':id/reprendre')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprendre une session en pause',
    description: 'Réactive une session en pause pour continuer les comptages.',
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiResponse({ status: 200, description: 'Session reprise' })
  @ApiResponse({ status: 400, description: 'La session n\'est pas en pause' })
  async reprendre(
    @Param('id', ParseIntPipe) sessionId: number,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.reprendre(sessionId, req.user.id);
  }

  // ============================================
  // HISTORIQUE
  // ============================================

  @Get(':id/historique')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Voir l\'historique de la session',
    description: 'Retourne l\'historique complet des actions effectuées sur la session.',
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiResponse({ status: 200, description: 'Historique de la session' })
  async getHistorique(@Param('id', ParseIntPipe) sessionId: number) {
    return this.inventairePhysiqueService.getHistorique(sessionId);
  }

  // ============================================
  // STATISTIQUES
  // ============================================

  @Get(':id/statistiques')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtenir les statistiques de la session',
    description: 'Retourne les statistiques détaillées: progression, écarts, valorisation.',
  })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiResponse({ status: 200, description: 'Statistiques de la session' })
  async getStatistiques(@Param('id', ParseIntPipe) sessionId: number) {
    const session = await this.inventairePhysiqueService.getSessionDetails(sessionId);
    return session.statistiques;
  }

  // ============================================
  // ROUTES SUPPLÉMENTAIRES FRONTEND
  // ============================================

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mettre à jour une session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async update(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() updateData: any,
  ) {
    return this.inventairePhysiqueService.update(sessionId, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async delete(@Param('id', ParseIntPipe) sessionId: number) {
    return this.inventairePhysiqueService.remove(sessionId);
  }

  @Post(':id/demarrer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Démarrer une session d\'inventaire' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async demarrer(
    @Param('id', ParseIntPipe) sessionId: number,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.demarrer(sessionId, req.user.id);
  }

  @Post(':id/terminer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminer une session d\'inventaire' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async terminer(
    @Param('id', ParseIntPipe) sessionId: number,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.terminer(sessionId, req.user.id);
  }

  @Get(':id/lignes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lister les lignes d\'une session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLignes(
    @Param('id', ParseIntPipe) sessionId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventairePhysiqueService.getLignes(sessionId, {
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Post(':id/lignes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter un produit à la session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async ajouterLigne(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() data: { produitId: number },
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.ajouterProduit(sessionId, data.produitId, req.user.id);
  }

  @Post(':id/lignes/:ligneId/compter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compter une ligne' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiParam({ name: 'ligneId', description: 'ID de la ligne' })
  async compterLigne(
    @Param('id', ParseIntPipe) sessionId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() data: { quantiteComptee: number; notes?: string },
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.compterLigne(sessionId, ligneId, data, req.user.id);
  }

  @Post(':id/lignes/:ligneId/recomptage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un recomptage' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiParam({ name: 'ligneId', description: 'ID de la ligne' })
  async demanderRecomptage(
    @Param('id', ParseIntPipe) sessionId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.demanderRecomptage(sessionId, ligneId, req.user.id);
  }

  @Post(':id/lignes/:ligneId/recompter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Effectuer le recomptage' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiParam({ name: 'ligneId', description: 'ID de la ligne' })
  async recompterLigne(
    @Param('id', ParseIntPipe) sessionId: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() data: { quantiteComptee: number; notes?: string },
    @Request() req: any,
  ) {
    return this.inventairePhysiqueService.recompterLigne(sessionId, ligneId, data, req.user.id);
  }

  @Get(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Résumé de la session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async getResume(@Param('id', ParseIntPipe) sessionId: number) {
    return this.inventairePhysiqueService.getResume(sessionId);
  }

  @Get(':id/progression')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Progression de la session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  async getProgression(@Param('id', ParseIntPipe) sessionId: number) {
    return this.inventairePhysiqueService.getProgression(sessionId);
  }

  @Get('actives')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sessions actives' })
  async getActives() {
    return this.inventairePhysiqueService.getActives();
  }

  @Get('statistiques')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Statistiques globales des inventaires physiques' })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  async getStatistiquesGlobales(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.inventairePhysiqueService.getStatistiquesGlobales({ dateDebut, dateFin });
  }

  @Get(':id/rapport')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Générer le rapport de la session' })
  @ApiParam({ name: 'id', description: 'ID de la session' })
  @ApiQuery({ name: 'format', enum: ['pdf', 'excel'], required: false })
  async genererRapport(
    @Param('id', ParseIntPipe) sessionId: number,
    @Query('format') format: string = 'pdf',
    @Res() res: any,
  ) {
    return this.inventairePhysiqueService.genererRapport(sessionId, format, res);
  }
}