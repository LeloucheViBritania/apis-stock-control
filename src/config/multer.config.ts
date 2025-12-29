// ============================================
// FICHIER: src/common/config/multer.config.ts
// Configuration Multer pour l'upload de fichiers
// ============================================

import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/**
 * Extensions de fichiers autorisées pour l'import
 */
const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls'];

/**
 * Types MIME autorisés
 */
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Taille maximale du fichier (5 Mo)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Configuration Multer pour l'import de fichiers
 */
export const importFileConfig: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    // Vérifier l'extension
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return callback(
        new BadRequestException(
          `Type de fichier non autorisé. Extensions acceptées: ${ALLOWED_EXTENSIONS.join(', ')}`,
        ),
        false,
      );
    }

    // Vérifier le type MIME (optionnel, car pas toujours fiable)
    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // On accepte quand même mais on log un warning
      console.warn(`Type MIME inhabituel: ${file.mimetype} pour ${file.originalname}`);
    }

    callback(null, true);
  },
};

/**
 * Décorateur personnalisé pour la documentation Swagger
 */
export const ApiImportFile = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Ajouter la métadonnée pour Swagger
    Reflect.defineMetadata('swagger/apiConsumes', ['multipart/form-data'], descriptor.value);
  };
};