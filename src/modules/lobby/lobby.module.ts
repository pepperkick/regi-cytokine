import { Module } from '@nestjs/common';
import { MessagingService } from 'src/messaging.service';
import { LobbyService } from './lobby.service';

@Module({
  imports: [
    // MongooseModule.forFeature([{ name: Lobby.name, schema: LobbySchema }]),
  ],
  controllers: [],
  providers: [LobbyService, MessagingService],
  exports: [LobbyService, MessagingService],
})
export class LobbyModule {}
