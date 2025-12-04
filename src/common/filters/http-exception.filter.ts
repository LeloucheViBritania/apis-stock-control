import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Une erreur interne est survenue';
    let error = 'Internal Server Error';

    // Gestion des exceptions HTTP de NestJS
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      }
    }
    // Gestion des erreurs Prisma
    else if (exception instanceof PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
      error = prismaError.error;
    }
    // Gestion des autres erreurs
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Erreur non gérée: ${exception.message}`,
        exception.stack,
      );
    }

    // Log de l'erreur
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${JSON.stringify(message)}`,
    );

    // Réponse d'erreur formatée
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    });
  }

  /**
   * Gère les erreurs spécifiques de Prisma
   */
  private handlePrismaError(exception: PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      // Violation de contrainte unique
      case 'P2002':
        const target = (exception.meta?.target as string[]) || [];
        const field = target[0] || 'champ';
        return {
          status: HttpStatus.CONFLICT,
          message: `Un enregistrement avec ce ${field} existe déjà`,
          error: 'Conflict',
        };

      // Enregistrement non trouvé
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Enregistrement non trouvé',
          error: 'Not Found',
        };

      // Violation de contrainte de clé étrangère
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Référence invalide : l\'enregistrement lié n\'existe pas',
          error: 'Bad Request',
        };

      // Violation de contrainte (relation requise)
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'La relation est requise et ne peut pas être vide',
          error: 'Bad Request',
        };

      // Échec de suppression en raison de dépendances
      case 'P2023':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Impossible de supprimer : des enregistrements dépendent de celui-ci',
          error: 'Conflict',
        };

      // Erreur de validation des données
      case 'P2011':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Validation échouée : une contrainte requise n\'est pas respectée',
          error: 'Bad Request',
        };

      // Champ requis manquant
      case 'P2012':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Un champ requis est manquant',
          error: 'Bad Request',
        };

      // Valeur nulle pour un champ non nullable
      case 'P2015':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Un champ obligatoire ne peut pas être vide',
          error: 'Bad Request',
        };

      // Valeur trop longue pour le type de colonne
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'La valeur fournie est trop longue pour le champ',
          error: 'Bad Request',
        };

      // Timeout de la base de données
      case 'P1008':
        return {
          status: HttpStatus.REQUEST_TIMEOUT,
          message: 'La requête a pris trop de temps, veuillez réessayer',
          error: 'Request Timeout',
        };

      // Impossible de se connecter à la base de données
      case 'P1001':
      case 'P1002':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Service de base de données temporairement indisponible',
          error: 'Service Unavailable',
        };

      // Erreur Prisma par défaut
      default:
        this.logger.error(`Erreur Prisma non gérée: ${exception.code}`, exception.message);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Une erreur de base de données est survenue',
          error: 'Database Error',
        };
    }
  }
}