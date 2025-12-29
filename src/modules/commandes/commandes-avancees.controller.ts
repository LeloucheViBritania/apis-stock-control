// ============================================
// FICHIER: src/modules/commandes/commandes-avancees.controller.ts
// Controller pour les fonctionnalités avancées de commandes
// ============================================

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CommandesAvanceesService } from './commandes-avancees.service';
import {
  DupliquerCommandeDto,
  ModifierLigneCommandeDto,
  AjouterLigneCommandeDto,
  SupprimerLigneCommandeDto,
  CreerSuiviLivraisonDto,
  MettreAJourSuiviDto,
  CreerDevisDto,
  ModifierDevisDto,
  ConvertirDevisDto,
  StatutDevis,
} from './dto/commandes-avancees.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// ============================================
// CONTROLLER COMMANDES AVANCÉES
// ============================================

@ApiTags('📦 Commandes - Fonctionnalités Avancées')
@ApiBearerAuth('JWT-auth')
@Controller('commandes')
@UseGuards(AuthGuard, RolesGuard)
export class CommandesAvanceesController {
  constructor(
    private readonly commandesAvanceesService: CommandesAvanceesService,
  ) {}

  // ============================================
  // DUPLIQUER UNE COMMANDE
  // ============================================

  @Post(':id/dupliquer')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Dupliquer une commande existante',
    description: `
      Crée une copie d'une commande existante avec possibilité de modifications.
      
      **Options:**
      - Changer le client ou l'entrepôt
      - Ajuster les quantités (multiplicateur)
      - Exclure certains produits
      - Mettre à jour les prix depuis le catalogue actuel
      
      **Cas d'usage:**
      - Commandes récurrentes
      - Commandes similaires pour différents clients
      - Réédition d'une commande annulée
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la commande à dupliquer' })
  @ApiBody({ type: DupliquerCommandeDto })
  @ApiResponse({ status: 201, description: 'Commande dupliquée avec succès' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async dupliquerCommande(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DupliquerCommandeDto,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.dupliquerCommande(id, dto, req.user.id);
  }

  // ============================================
  // MODIFIER LES LIGNES
  // ============================================

  @Post(':id/modifier-ligne')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Modifier une ligne de commande',
    description: `
      Permet de modifier la quantité ou le prix d'une ligne après création.
      
      **Restrictions:**
      - Commande ne doit pas être expédiée, livrée ou annulée
      - L'historique des modifications est conservé
      
      **Modifiable:**
      - Quantité
      - Prix unitaire
      - Remise
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiBody({ type: ModifierLigneCommandeDto })
  @ApiResponse({ status: 200, description: 'Ligne modifiée' })
  async modifierLigne(
    @Param('id', ParseIntPipe) commandeId: number,
    @Body() dto: ModifierLigneCommandeDto,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.modifierLigneCommande(
      commandeId,
      dto,
      req.user.id,
    );
  }

  @Post(':id/ajouter-ligne')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Ajouter une ligne à une commande',
    description: 'Ajoute un nouveau produit à une commande existante.',
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiBody({ type: AjouterLigneCommandeDto })
  @ApiResponse({ status: 201, description: 'Ligne ajoutée' })
  async ajouterLigne(
    @Param('id', ParseIntPipe) commandeId: number,
    @Body() dto: AjouterLigneCommandeDto,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.ajouterLigneCommande(
      commandeId,
      dto,
      req.user.id,
    );
  }

  @Post(':id/supprimer-ligne')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Supprimer une ligne de commande',
    description: 'Retire un produit d\'une commande. La dernière ligne ne peut pas être supprimée.',
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiBody({ type: SupprimerLigneCommandeDto })
  @ApiResponse({ status: 200, description: 'Ligne supprimée' })
  async supprimerLigne(
    @Param('id', ParseIntPipe) commandeId: number,
    @Body() dto: SupprimerLigneCommandeDto,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.supprimerLigneCommande(
      commandeId,
      dto,
      req.user.id,
    );
  }

  // ============================================
  // SUIVI DE LIVRAISON
  // ============================================

  @Get(':id/suivi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtenir le suivi de livraison',
    description: `
      Retourne l'état de la livraison d'une commande:
      - Statut actuel
      - Informations transporteur
      - Historique des événements
      - Progression en pourcentage
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({
    status: 200,
    description: 'Informations de suivi',
    schema: {
      example: {
        id: 1,
        commandeId: 15,
        numeroCommande: 'CMD-202501-0015',
        transporteur: 'DHL Express',
        numeroSuivi: 'DHL1234567890',
        statut: 'EN_TRANSIT',
        progression: 50,
        evenements: [
          {
            statut: 'EN_TRANSIT',
            description: 'Colis en transit',
            localisation: 'Abidjan - Centre de tri',
            date: '2025-01-28T10:30:00Z',
          },
        ],
      },
    },
  })
  async getSuiviLivraison(@Param('id', ParseIntPipe) commandeId: number) {
    return this.commandesAvanceesService.getSuiviLivraison(commandeId);
  }

  @Post(':id/suivi')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Créer ou mettre à jour les informations de livraison',
    description: 'Configure les informations de transporteur et d\'adresse de livraison.',
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiBody({ type: CreerSuiviLivraisonDto })
  @ApiResponse({ status: 200, description: 'Suivi créé/mis à jour' })
  async creerSuivi(
    @Param('id', ParseIntPipe) commandeId: number,
    @Body() dto: CreerSuiviLivraisonDto,
  ) {
    return this.commandesAvanceesService.creerOuMettreAJourSuivi(commandeId, dto);
  }

  @Put(':id/suivi/statut')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Mettre à jour le statut de livraison',
    description: `
      Change le statut de livraison et enregistre un événement.
      
      **Statuts possibles:**
      - EN_PREPARATION → EXPEDIE → EN_TRANSIT → EN_LIVRAISON → LIVRE
      - ECHEC_LIVRAISON (si problème)
      - RETOURNE (si retour)
      
      Met également à jour le statut de la commande si nécessaire.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiBody({ type: MettreAJourSuiviDto })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async mettreAJourStatutSuivi(
    @Param('id', ParseIntPipe) commandeId: number,
    @Body() dto: MettreAJourSuiviDto,
  ) {
    return this.commandesAvanceesService.mettreAJourStatutSuivi(commandeId, dto);
  }
}

// ============================================
// CONTROLLER DEVIS
// ============================================

@ApiTags('📋 Devis')
@ApiBearerAuth('JWT-auth')
@Controller('commandes/devis')
@UseGuards(AuthGuard, RolesGuard)
export class DevisController {
  constructor(
    private readonly commandesAvanceesService: CommandesAvanceesService,
  ) {}

  // ============================================
  // CRÉER UN DEVIS
  // ============================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Créer un devis',
    description: `
      Crée un nouveau devis client.
      
      **Caractéristiques:**
      - Client existant ou nouveau (nom/email/téléphone)
      - Date de validité obligatoire
      - Remise globale et par ligne
      - Calcul automatique TVA
      - Conditions de paiement et délai de livraison
      
      **Statut initial:** BROUILLON
    `,
  })
  @ApiBody({ type: CreerDevisDto })
  @ApiResponse({ status: 201, description: 'Devis créé' })
  async creerDevis(@Body() dto: CreerDevisDto, @Request() req: any) {
    return this.commandesAvanceesService.creerDevis(dto, req.user.id);
  }

  // ============================================
  // DÉTAILS D'UN DEVIS
  // ============================================

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtenir les détails d\'un devis',
    description: 'Retourne toutes les informations d\'un devis avec calcul de validité.',
  })
  @ApiParam({ name: 'id', description: 'ID du devis' })
  @ApiResponse({ status: 200, description: 'Détails du devis' })
  async getDevis(@Param('id', ParseIntPipe) id: number) {
    return this.commandesAvanceesService.getDevisDetails(id);
  }

  // ============================================
  // CONVERTIR EN COMMANDE
  // ============================================

  @Post(':id/convertir')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Convertir un devis en commande',
    description: `
      Transforme un devis accepté en commande.
      
      **Actions:**
      - Crée une nouvelle commande avec les lignes du devis
      - Met le devis en statut CONVERTI
      - Lie le devis à la commande
      
      **Options:**
      - Vérifier la disponibilité du stock
      - Réserver le stock automatiquement
      
      **Restrictions:**
      - Le devis ne doit pas être déjà converti, refusé ou expiré
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du devis' })
  @ApiBody({ type: ConvertirDevisDto })
  @ApiResponse({
    status: 201,
    description: 'Devis converti en commande',
    schema: {
      example: {
        success: true,
        devis: {
          id: 1,
          numeroDevis: 'DEV-202501-0001',
          ancienStatut: 'ACCEPTE',
        },
        commande: {
          id: 15,
          numeroCommande: 'CMD-202501-0015',
          montantTotal: 1500000,
          statut: 'EN_ATTENTE',
        },
        message: 'Devis converti en commande CMD-202501-0015',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Devis non convertible' })
  async convertirDevis(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertirDevisDto,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.convertirDevisEnCommande(
      id,
      dto,
      req.user.id,
    );
  }

  // ============================================
  // CHANGER LE STATUT
  // ============================================

  @Put(':id/statut')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Changer le statut d\'un devis',
    description: `
      Modifie le statut d'un devis.
      
      **Transitions possibles:**
      - BROUILLON → ENVOYE (envoi au client)
      - ENVOYE → ACCEPTE | REFUSE
      - * → EXPIRE (automatique ou manuel)
      
      **Note:** Un devis CONVERTI ne peut plus être modifié.
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du devis' })
  @ApiQuery({ name: 'statut', enum: StatutDevis })
  @ApiQuery({ name: 'raison', required: false })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async changerStatut(
    @Param('id', ParseIntPipe) id: number,
    @Query('statut') statut: StatutDevis,
    @Query('raison') raison: string,
    @Request() req: any,
  ) {
    return this.commandesAvanceesService.changerStatutDevis(
      id,
      statut,
      req.user.id,
      raison,
    );
  }
}