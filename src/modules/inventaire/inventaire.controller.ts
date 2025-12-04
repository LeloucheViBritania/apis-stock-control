import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { InventaireService } from './inventaire.service';
import { CreateInventaireDto } from './dto/create-inventaire.dto';
import { UpdateInventaireDto } from './dto/update-inventaire.dto'
import { AjusterQuantiteDto } from './dto/ajuster-quantite.dto'
import { ReserverStockDto } from './dto/reserver-stock.dto'
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';

/**
 * Contrôleur pour la gestion de l'inventaire multi-entrepôts
 * 
 * Fonctionnalité PREMIUM - Nécessite un abonnement premium
 * 
 * Ce contrôleur expose les endpoints pour :
 * - CRUD complet sur les entrées d'inventaire
 * - Ajustements de quantités
 * - Réservation et libération de stock
 * - Recherche et filtrage avancés
 * - Statistiques et rapports
 * 
 * @controller inventaire
 */
@ApiTags('Inventaire (PREMIUM)')
@ApiBearerAuth()
@Controller('inventaire')
@UseGuards(AuthGuard, PremiumGuard)
export class InventaireController {
  constructor(private readonly inventaireService: InventaireService) {}

  /**
   * Créer une nouvelle entrée d'inventaire
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une entrée d\'inventaire',
    description: 'Initialise l\'inventaire d\'un produit dans un entrepôt spécifique.',
  })
  @ApiBody({
    type: CreateInventaireDto,
    examples: {
      exemple1: {
        summary: 'Inventaire complet',
        value: {
          produitId: 42,
          entrepotId: 1,
          quantite: 100,
          quantiteReservee: 10,
          emplacement: 'A1-B3',
        },
      },
      exemple2: {
        summary: 'Inventaire minimal',
        value: {
          produitId: 15,
          entrepotId: 2,
          quantite: 50,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Entrée d\'inventaire créée avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit ou entrepôt non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Une entrée existe déjà pour ce produit dans cet entrepôt',
  })
  create(@Body() createInventaireDto: CreateInventaireDto) {
    return this.inventaireService.create(createInventaireDto);
  }

  /**
   * Récupérer tous les inventaires avec filtres
   */
  @Get()
  @ApiOperation({
    summary: 'Récupérer tous les inventaires',
    description: 'Liste tous les inventaires avec possibilité de filtrage avancé.',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiQuery({
    name: 'produitId',
    required: false,
    type: Number,
    description: 'Filtrer par produit',
  })
  @ApiQuery({
    name: 'categorieId',
    required: false,
    type: Number,
    description: 'Filtrer par catégorie de produit',
  })
  @ApiQuery({
    name: 'stockFaible',
    required: false,
    type: Boolean,
    description: 'Afficher uniquement les stocks faibles',
  })
  @ApiQuery({
    name: 'rupture',
    required: false,
    type: Boolean,
    description: 'Afficher uniquement les ruptures de stock',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche textuelle (nom produit, référence)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des inventaires récupérée avec succès',
  })
  findAll(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
    @Query('produitId', new ParseIntPipe({ optional: true })) produitId?: number,
    @Query('categorieId', new ParseIntPipe({ optional: true })) categorieId?: number,
    @Query('stockFaible') stockFaible?: string,
    @Query('rupture') rupture?: string,
    @Query('search') search?: string,
  ) {
    return this.inventaireService.findAll({
      entrepotId,
      produitId,
      categorieId,
      stockFaible: stockFaible === 'true',
      rupture: rupture === 'true',
      search,
    });
  }

  /**
   * Obtenir les statistiques globales
   */
  @Get('statistiques')
  @ApiOperation({
    summary: 'Obtenir les statistiques de l\'inventaire',
    description: 'Retourne des statistiques globales : total produits, articles, valeur, stocks faibles, ruptures.',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
    schema: {
      example: {
        totalProduits: 150,
        totalArticles: 5420,
        totalReserve: 320,
        totalDisponible: 5100,
        valeurTotale: 125000.50,
        stocksFaibles: 12,
        ruptures: 3,
        produitsAvecEmplacement: 145,
        tauxEmplacement: 97,
      },
    },
  })
  getStatistiques(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getStatistiques(entrepotId);
  }

  /**
   * Obtenir les stocks faibles
   */
  @Get('stocks-faibles')
  @ApiOperation({
    summary: 'Obtenir les stocks faibles',
    description: 'Retourne tous les produits dont la quantité est inférieure ou égale au niveau minimum.',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des stocks faibles',
  })
  getStocksFaibles(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getStocksFaibles(entrepotId);
  }

  /**
   * Obtenir les ruptures de stock
   */
  @Get('ruptures')
  @ApiOperation({
    summary: 'Obtenir les ruptures de stock',
    description: 'Retourne tous les produits dont la quantité est à zéro.',
  })
  @ApiQuery({
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des ruptures de stock',
  })
  getRuptures(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getRuptures(entrepotId);
  }

  /**
   * Obtenir la disponibilité d'un produit dans tous les entrepôts
   */
  @Get('produit/:produitId/disponibilites')
  @ApiOperation({
    summary: 'Obtenir la disponibilité d\'un produit',
    description: 'Retourne la disponibilité d\'un produit dans tous les entrepôts.',
  })
  @ApiParam({
    name: 'produitId',
    type: Number,
    description: 'ID du produit',
  })
  @ApiResponse({
    status: 200,
    description: 'Disponibilités récupérées avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit non trouvé',
  })
  getDisponibilitesProduit(@Param('produitId', ParseIntPipe) produitId: number) {
    return this.inventaireService.getDisponibilitesProduit(produitId);
  }

  /**
   * Récupérer une entrée d'inventaire par ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer une entrée d\'inventaire',
    description: 'Retourne les détails complets d\'une entrée d\'inventaire.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiResponse({
    status: 200,
    description: 'Entrée d\'inventaire trouvée',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée d\'inventaire non trouvée',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventaireService.findOne(id);
  }

  /**
   * Mettre à jour une entrée d'inventaire
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour une entrée d\'inventaire',
    description: 'Met à jour les informations d\'une entrée d\'inventaire (quantité, emplacement, etc.).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiBody({
    type: UpdateInventaireDto,
    examples: {
      exemple1: {
        summary: 'Changer l\'emplacement',
        value: {
          emplacement: 'B2-C4',
        },
      },
      exemple2: {
        summary: 'Mettre à jour après inventaire physique',
        value: {
          quantite: 95,
          derniereVerification: '2025-11-19T10:30:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Entrée mise à jour avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée non trouvée',
  })
  @ApiResponse({
    status: 400,
    description: 'Quantité réservée > quantité totale',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventaireDto: UpdateInventaireDto,
  ) {
    return this.inventaireService.update(id, updateInventaireDto);
  }

  /**
   * Ajuster la quantité en stock
   */
  @Post(':id/ajuster')
  @ApiOperation({
    summary: 'Ajuster la quantité en stock',
    description: 'Permet d\'ajouter, retirer ou définir une quantité absolue.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiBody({
    type: AjusterQuantiteDto,
    examples: {
      ajouter: {
        summary: 'Ajouter du stock',
        value: {
          type: 'ajouter',
          quantite: 50,
          raison: 'Réception fournisseur',
        },
      },
      retirer: {
        summary: 'Retirer du stock',
        value: {
          type: 'retirer',
          quantite: 20,
          raison: 'Vente',
        },
      },
      definir: {
        summary: 'Définir quantité absolue',
        value: {
          type: 'definir',
          quantite: 100,
          raison: 'Inventaire physique',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Quantité ajustée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Opération invalide (quantité négative, etc.)',
  })
  ajusterQuantite(
    @Param('id', ParseIntPipe) id: number,
    @Body() ajusterDto: AjusterQuantiteDto,
  ) {
    return this.inventaireService.ajusterQuantite(id, ajusterDto);
  }

  /**
   * Réserver du stock
   */
  @Post(':id/reserver')
  @ApiOperation({
    summary: 'Réserver du stock',
    description: 'Augmente la quantité réservée pour une commande ou autre utilisation.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiBody({
    type: ReserverStockDto,
    examples: {
      exemple1: {
        summary: 'Réserver pour une commande',
        value: {
          quantite: 10,
          reference: 'CMD-2025-001',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Stock réservé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Stock disponible insuffisant',
  })
  reserverStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() reserverDto: ReserverStockDto,
  ) {
    return this.inventaireService.reserverStock(id, reserverDto);
  }

  /**
   * Libérer du stock réservé
   */
  @Post(':id/liberer')
  @ApiOperation({
    summary: 'Libérer du stock réservé',
    description: 'Diminue la quantité réservée (annulation de commande, etc.).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiBody({
    type: ReserverStockDto,
    examples: {
      exemple1: {
        summary: 'Libérer suite à annulation',
        value: {
          quantite: 5,
          reference: 'CMD-2025-001',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Stock libéré avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Quantité à libérer > quantité réservée',
  })
  libererStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() libererDto: ReserverStockDto,
  ) {
    return this.inventaireService.libererStock(id, libererDto);
  }

  /**
   * Supprimer une entrée d'inventaire
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer une entrée d\'inventaire',
    description: 'Supprime définitivement une entrée d\'inventaire. Refusé si du stock est réservé.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'entrée d\'inventaire',
  })
  @ApiResponse({
    status: 200,
    description: 'Entrée supprimée avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrée non trouvée',
  })
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer : du stock est réservé',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventaireService.remove(id);
  }
}