import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbyModule } from './modules/lobby/lobby.module';
import { LobbyCommand } from './commands/lobby.command';
import { DiscordService } from './discord.service';

import * as config from '../config.json';
import {
  DiscordInfo,
  DiscordInfoSchema,
} from './objects/discord-info/discord-info.model';

@Module({
  imports: [LobbyModule, MongooseModule.forRoot(config.mongodbUri)],
  controllers: [AppController],
  providers: [AppService, DiscordService, LobbyCommand],
  exports: [DiscordService],
})
export class AppModule {}
