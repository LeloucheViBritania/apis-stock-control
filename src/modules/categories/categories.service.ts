import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Vérifier si la categorie existe déjà
    await this.checkExisting(createCategoryDto.nom);

    // Vérifier que la catégorie parente existe si spécifiée
    if (createCategoryDto.categorieParenteId) {
      const parent = await this.prisma.categorie.findUnique({
        where: { id: createCategoryDto.categorieParenteId },
      });

      if (!parent) {
        throw new NotFoundException('Catégorie parente non trouvée');
      }
    }

    return this.prisma.categorie.create({
      data: createCategoryDto,
      include: {
        categorieParente: true,
        sousCategories: true,
      },
    });
  }

  async findAll() {
    return this.prisma.categorie.findMany({
      include: {
        categorieParente: true,
        sousCategories: true,
        _count: {
          select: {
            produits: true,
          },
        },
      },
      orderBy: {
        nom: 'asc',
      },
    });
  }

  // Récupérer l'arbre hiérarchique des catégories
  async findTree() {
    const categories = await this.prisma.categorie.findMany({
      where: {
        categorieParenteId: null, // Catégories racines
      },
      include: {
        sousCategories: {
          include: {
            sousCategories: {
              include: {
                sousCategories: true,
              },
            },
          },
        },
        _count: {
          select: {
            produits: true,
          },
        },
      },
      orderBy: {
        nom: 'asc',
      },
    });

    return categories;
  }

  async findOne(id: number) {
    const categorie = await this.prisma.categorie.findUnique({
      where: { id },
      include: {
        categorieParente: true,
        sousCategories: true,
        produits: {
          take: 10,
          orderBy: { nom: 'asc' },
        },
        _count: {
          select: {
            produits: true,
            sousCategories: true,
          },
        },
      },
    });

    if (!categorie) {
      throw new NotFoundException(`Catégorie #${id} non trouvée`);
    }

    return categorie;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);

    // ⭐ Vérifier si le nouveau nom existe déjà (mais pas pour la catégorie actuelle)
    if (updateCategoryDto.nom) {
      await this.checkExisting(updateCategoryDto.nom, id);
    }

    // Éviter les boucles infinies (une catégorie ne peut pas être son propre parent)
    if (updateCategoryDto.categorieParenteId === id) {
      throw new BadRequestException('Une catégorie ne peut pas être son propre parent');
    }

    return this.prisma.categorie.update({
      where: { id },
      data: updateCategoryDto,
      include: {
        categorieParente: true,
        sousCategories: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Vérifier s'il y a des produits dans cette catégorie
    const produitsCount = await this.prisma.produit.count({
      where: { categorieId: id },
    });

    if (produitsCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer cette catégorie car elle contient ${produitsCount} produit(s)`,
      );
    }

    return this.prisma.categorie.delete({
      where: { id },
    });
  }

  async getStatistiques() {
    const [totalCategories, categoriesRacines, categoriesAvecProduits] = await Promise.all([
      this.prisma.categorie.count(),
      this.prisma.categorie.count({
        where: { categorieParenteId: null },
      }),
      this.prisma.categorie.count({
        where: {
          produits: {
            some: {},
          },
        },
      }),
    ]);

    return {
      totalCategories,
      categoriesRacines,
      categoriesAvecProduits,
      categoriesVides: totalCategories - categoriesAvecProduits,
    };
  }

  /**
   * Vérifie si une catégorie avec ce nom existe déjà
   * @param nomCategory - Nom de la catégorie à vérifier
   * @param excludeId - ID de la catégorie à exclure de la vérification (pour les mises à jour)
   */
  async checkExisting(nomCategory: string, excludeId?: number): Promise<void> {
    // Construire la condition where
    const whereCondition: any = {
      nom: nomCategory, // Correction : enlever le '?'
    };

    // Si on met à jour, exclure l'ID actuel de la vérification
    if (excludeId) {
      whereCondition.id = {
        not: excludeId,
      };
    }

    // Utiliser findFirst au lieu de count pour plus de performance
    const existingCategorie = await this.prisma.categorie.findFirst({
      where: whereCondition,
      select: { id: true, nom: true },
    });

    if (existingCategorie) {
      throw new ConflictException(
        `Une catégorie avec le nom "${nomCategory}" existe déjà`,
      );
    }
  }
}