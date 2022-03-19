import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscordService } from 'src/discord.service';
import { MessagingService } from 'src/messaging.service';
import { Lobby, LobbySchema } from 'src/modules/lobby/lobby.model';
import { LobbyService } from './lobby.service';
import { PreferenceModule } from '../preferences/preference.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lobby.name, schema: LobbySchema }]),
    PreferenceModule,
  ],
  controllers: [],
  providers: [LobbyService, MessagingService, DiscordService],
  exports: [LobbyService, MessagingService, DiscordService],
})
export class LobbyModule {}
