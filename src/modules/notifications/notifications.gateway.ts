import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200', // Autoriser votre frontend
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
  }

  // Méthode pour envoyer l'alerte à tout le monde (Broadcast)
  sendStockAlert(payload: { produit: string; stockRestant: number; message: string }) {
    this.server.emit('stock-critique', payload);
    this.logger.warn(`Alerte envoyée : ${payload.message}`);
  }
}