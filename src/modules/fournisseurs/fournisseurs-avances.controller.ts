// ============================================
// FICHIER: src/modules/fournisseurs/fournisseurs-avances.controller.ts
// Controller pour les fonctionnalités avancées fournisseurs
// ============================================

import {
  Controller,
  Get,
  Post,
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
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { FournisseursAvancesService } from './fournisseurs-avances.service';
import {
  NoterFournisseurDto,
  FiltresCommandesFournisseurDto,
  FiltresProduitsFournisseurDto,
  SignalerIncidentDto,
} from './dto/fournisseurs-avances.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('🏢 Fournisseurs - Fonctionnalités Avancées')
@ApiBearerAuth('JWT-auth')
@Controller('fournisseurs')
@UseGuards(AuthGuard, RolesGuard)
export class FournisseursAvancesController {
  constructor(
    private readonly fournisseursAvancesService: FournisseursAvancesService,
  ) {}

  // ============================================
  // ÉVALUATION FOURNISSEUR
  // ============================================

  @Get(':id/evaluation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtenir l\'évaluation complète d\'un fournisseur',
    description: `
      Retourne les statistiques et notes d'un fournisseur:
      
      **Notes (sur 5):**
      - Qualité des produits
      - Respect des délais
      - Compétitivité prix
      - Communication/réactivité
      - Conformité des commandes
      
      **Statistiques:**
      - Nombre de commandes (total, livrées, en retard)
      - Montant total des achats
      - Délai moyen de livraison
      - Taux de respect des délais
      - Nombre d'incidents
      
      **Classement:**
      - Rang parmi tous les fournisseurs
      - Catégorie (A=Excellent, B=Bon, C=Acceptable, D=À surveiller)
      - Tendance (hausse/stable/baisse)
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du fournisseur' })
  @ApiResponse({
    status: 200,
    description: 'Évaluation du fournisseur',
    schema: {
      example: {
        fournisseurId: 1,
        fournisseur: { id: 1, nom: 'Tech SA', email: 'contact@techsa.ci' },
        notes: {
          qualite: 4.2,
          delai: 3.8,
          prix: 4.0,
          communication: 4.5,
          conformite: 4.3,
          globale: 4.16,
        },
        nombreEvaluations: 12,
        tauxRecommandation: 92,
        commandes: {
          total: 45,
          livrees: 42,
          enRetard: 3,
          montantTotal: 15000000,
        },
        performance: {
          delaiMoyen: 5.2,
          tauxRespectDelai: 93,
          tauxConformite: 96,
          nombreLitiges: 2,
        },
        classement: { rang: 3, categorie: 'A', totalFournisseurs: 25 },
        tendance: 'STABLE',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  async getEvaluation(@Param('id', ParseIntPipe) id: number) {
    return this.fournisseursAvancesService.getEvaluation(id);
  }

  // ============================================
  // NOTER UN FOURNISSEUR
  // ============================================

  @Post(':id/noter')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Noter un fournisseur',
    description: `
      Crée une évaluation pour un fournisseur.
      
      **Notes requises (1-5):**
      - noteQualite: Qualité des produits reçus
      - noteDelai: Respect des délais de livraison
      - notePrix: Compétitivité des prix
      - noteCommunication: Réactivité et communication
      - noteConformite: Conformité avec la commande
      
      **Options:**
      - Lier à un bon de commande spécifique
      - Ajouter des commentaires
      - Identifier les points forts/à améliorer
      - Indiquer si vous recommandez ce fournisseur
      
      **Note globale:**
      Calculée automatiquement avec pondération:
      - Qualité: 25%
      - Délai: 25%
      - Prix: 20%
      - Communication: 15%
      - Conformité: 15%
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du fournisseur' })
  @ApiBody({ type: NoterFournisseurDto })
  @ApiResponse({ status: 201, description: 'Évaluation créée' })
  @ApiResponse({ status: 400, description: 'Données invalides ou commande déjà évaluée' })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  async noter(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NoterFournisseurDto,
    @Request() req: any,
  ) {
    return this.fournisseursAvancesService.noterFournisseur(id, dto, req.user.id);
  }

  // ============================================
  // HISTORIQUE DES COMMANDES
  // ============================================

  @Get(':id/commandes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Historique des commandes d\'un fournisseur',
    description: `
      Liste toutes les commandes passées à ce fournisseur.
      
      **Filtres disponibles:**
      - Statut de la commande
      - Période (date début/fin)
      
      **Informations par commande:**
      - Numéro et dates
      - Statut et montant
      - Nombre de lignes
      - Retard éventuel (en jours)
      - Indicateur d'évaluation
      
      **Résumé:**
      - Total des commandes
      - Montant cumulé
      - Taux de livraison
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du fournisseur' })
  @ApiQuery({ name: 'statut', required: false, example: 'LIVREE' })
  @ApiQuery({ name: 'dateDebut', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'dateFin', required: false, example: '2024-12-31' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste des commandes' })
  async getCommandes(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtres: FiltresCommandesFournisseurDto,
  ) {
    return this.fournisseursAvancesService.getHistoriqueCommandes(id, filtres);
  }

  // ============================================
  // CATALOGUE PRODUITS
  // ============================================

  @Get(':id/produits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Catalogue des produits d\'un fournisseur',
    description: `
      Liste tous les produits fournis par ce fournisseur.
      
      **Filtres disponibles:**
      - Par catégorie
      - Recherche par nom/référence
      - Produits préférés uniquement
      - Produits en stock uniquement
      
      **Informations par produit:**
      - Référence et nom
      - Prix fournisseur
      - Délai de livraison
      - Quantité minimale
      - Statut "préféré"
      - Dernier achat (date, quantité, prix)
      
      **Résumé:**
      - Nombre total de produits
      - Répartition par catégorie
      - Nombre de produits préférés
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du fournisseur' })
  @ApiQuery({ name: 'categorieId', required: false, example: 2 })
  @ApiQuery({ name: 'recherche', required: false, example: 'clavier' })
  @ApiQuery({ name: 'preferesUniquement', required: false, example: false })
  @ApiQuery({ name: 'enStockUniquement', required: false, example: true })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Catalogue des produits' })
  async getProduits(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtres: FiltresProduitsFournisseurDto,
  ) {
    return this.fournisseursAvancesService.getCatalogueProduits(id, filtres);
  }

  // ============================================
  // SIGNALER UN INCIDENT
  // ============================================

  @Post(':id/incident')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Signaler un incident avec un fournisseur',
    description: `
      Enregistre un problème rencontré avec ce fournisseur.
      
      **Types d'incidents:**
      - RETARD: Livraison en retard
      - NON_CONFORMITE: Produit non conforme
      - PRODUIT_DEFECTUEUX: Produit défectueux
      - QUANTITE_INCORRECTE: Quantité différente
      - DOCUMENTATION_MANQUANTE: Documents manquants
      - PRIX_DIFFERENT: Prix facturé différent
      - AUTRE: Autre problème
      
      **Niveaux d'impact:**
      - FAIBLE: Impact mineur
      - MOYEN: Impact modéré
      - ELEVE: Impact significatif
      - CRITIQUE: Impact majeur sur l'activité
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du fournisseur' })
  @ApiBody({ type: SignalerIncidentDto })
  @ApiResponse({ status: 201, description: 'Incident signalé' })
  async signalerIncident(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SignalerIncidentDto,
    @Request() req: any,
  ) {
    return this.fournisseursAvancesService.signalerIncident(id, dto, req.user.id);
  }

  // ============================================
  // COMPARAISON FOURNISSEURS
  // ============================================

  @Get('comparer/:produitId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comparer les fournisseurs pour un produit',
    description: `
      Compare tous les fournisseurs qui proposent un produit donné.
      
      **Critères de comparaison:**
      - Prix unitaire
      - Délai de livraison
      - Note globale du fournisseur
      - Catégorie (A/B/C/D)
      - Date du dernier achat
      
      **Indicateurs:**
      - Meilleur prix
      - Meilleur délai
      - Fournisseur préféré
    `,
  })
  @ApiParam({ name: 'produitId', description: 'ID du produit' })
  @ApiResponse({
    status: 200,
    description: 'Comparaison des fournisseurs',
    schema: {
      example: {
        produitId: 42,
        produit: { reference: 'CLV-001', nom: 'Clavier sans fil' },
        fournisseurs: [
          {
            fournisseur: { id: 1, nom: 'Tech SA', noteGlobale: 4.2, categorie: 'A' },
            prixUnitaire: 15000,
            delaiLivraison: 3,
            estPrefere: true,
          },
          {
            fournisseur: { id: 2, nom: 'Info Plus', noteGlobale: 3.8, categorie: 'B' },
            prixUnitaire: 14500,
            delaiLivraison: 7,
            estPrefere: false,
          },
        ],
        meilleurPrix: 14500,
        meilleurDelai: 3,
      },
    },
  })
  async comparer(@Param('produitId', ParseIntPipe) produitId: number) {
    return this.fournisseursAvancesService.comparerFournisseurs(produitId);
  }
}