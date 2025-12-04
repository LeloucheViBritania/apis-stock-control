import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Intercepteur pour l'audit automatique des actions
 * 
 * Enregistre automatiquement toutes les actions de modification
 * (POST, PUT, PATCH, DELETE) dans le journal d'audit.
 * 
 * Fonctionnalité PREMIUM - Les logs ne sont créés que pour les utilisateurs premium
 * 
 * @class AuditLogInterceptor
 * @implements {NestInterceptor}
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  /**
   * Intercepte les requêtes et crée des logs d'audit pour les modifications
   * 
   * @param {ExecutionContext} context - Contexte d'exécution
   * @param {CallHandler} next - Handler suivant
   * @returns {Observable<any>} Observable de la réponse
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;
    const method = request.method;
    const url = request.url;

    // Vérifier si l'audit est désactivé pour cette route
    const skipAudit = this.reflector.get<boolean>(
      'skipAudit',
      context.getHandler(),
    );

    if (skipAudit) {
      return next.handle();
    }

    // Ne logger que les modifications (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const action = this.getActionName(method, url);
    const body = request.body;
    const ip = this.getClientIp(request);

    // Extraire les informations de table et ID si disponibles
    const { nomTable, enregistrementId } = this.extractTableInfo(url, method);

    return next.handle().pipe(
      tap(async (responseData) => {
        // Vérifier si l'utilisateur a un abonnement Premium
        if (user?.tierAbonnement === 'PREMIUM') {
          try {
            await this.createAuditLog({
              utilisateurId: user?.id,
              action,
              nomTable,
              enregistrementId: enregistrementId || responseData?.id,
              nouvellesValeurs: this.sanitizeData(body),
              adresseIp: ip,
            });
          } catch (error) {
            // Ne pas faire échouer la requête si le log échoue
            console.error('Erreur lors de la création du log d\'audit:', error);
          }
        }
      }),
    );
  }

  /**
   * Crée une entrée dans le journal d'audit
   * 
   * @private
   * @param {Object} data - Données du log
   */
  private async createAuditLog(data: {
    utilisateurId?: number;
    action: string;
    nomTable?: string;
    enregistrementId?: number;
    nouvellesValeurs?: any;
    adresseIp?: string;
  }) {
    await this.prisma.journalAudit.create({
      data: {
        utilisateurId: data.utilisateurId,
        action: data.action,
        nomTable: data.nomTable,
        enregistrementId: data.enregistrementId,
        nouvellesValeurs: data.nouvellesValeurs,
        adresseIp: data.adresseIp,
      },
    });
  }

  /**
   * Génère un nom d'action lisible
   * 
   * @private
   * @param {string} method - Méthode HTTP
   * @param {string} url - URL de la requête
   * @returns {string} Nom de l'action
   * 
   * @example
   * getActionName('POST', '/produits') → 'CREATE_PRODUIT'
   * getActionName('DELETE', '/produits/5') → 'DELETE_PRODUIT'
   */
  private getActionName(method: string, url: string): string {
    const actionMap = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    const actionPrefix = actionMap[method] || method;
    
    // Extraire le nom de la ressource de l'URL
    const urlParts = url.split('/').filter(part => part && !part.match(/^\d+$/));
    const resource = urlParts[0] || 'RESOURCE';

    return `${actionPrefix}_${resource.toUpperCase()}`;
  }

  /**
   * Extrait le nom de la table et l'ID de l'enregistrement depuis l'URL
   * 
   * @private
   * @param {string} url - URL de la requête
   * @param {string} method - Méthode HTTP
   * @returns {Object} Informations extraites
   * 
   * @example
   * extractTableInfo('/produits/5', 'DELETE') 
   * → { nomTable: 'produits', enregistrementId: 5 }
   */
  private extractTableInfo(url: string, method: string): {
    nomTable?: string;
    enregistrementId?: number;
  } {
    const urlParts = url.split('/').filter(Boolean);
    
    if (urlParts.length === 0) {
      return {};
    }

    const nomTable = urlParts[0];
    
    // Pour PUT, PATCH, DELETE, l'ID est généralement dans l'URL
    if (['PUT', 'PATCH', 'DELETE'].includes(method) && urlParts.length >= 2) {
      const idPart = urlParts[1];
      const enregistrementId = parseInt(idPart);
      
      if (!isNaN(enregistrementId)) {
        return { nomTable, enregistrementId };
      }
    }

    return { nomTable };
  }

  /**
   * Récupère l'adresse IP réelle du client
   * 
   * Prend en compte les proxies et load balancers
   * 
   * @private
   * @param {Request} request - Requête HTTP
   * @returns {string} Adresse IP
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Nettoie les données sensibles avant de les logger
   * 
   * Supprime les mots de passe, tokens, etc.
   * 
   * @private
   * @param {any} data - Données à nettoyer
   * @returns {any} Données nettoyées
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'motDePasse',
      'motDePasseHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}