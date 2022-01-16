import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscordService } from 'src/discord.service';
import { MessagingService } from 'src/messaging.service';
import {
  DiscordInfo,
  DiscordInfoSchema,
} from 'src/objects/discord-info/discord-info.model';
import { LobbyService } from './lobby.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiscordInfo.name, schema: DiscordInfoSchema },
    ]),
  ],
  controllers: [],
  providers: [LobbyService, MessagingService, DiscordService],
  exports: [LobbyService, MessagingService, DiscordService],
})
export class LobbyModule {}
