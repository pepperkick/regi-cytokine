import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { LobbyCommand } from './commands/lobby.command';
import { DiscordService } from './discord.service';

import { Lobby, LobbySchema } from './modules/lobby/lobby.model';

import * as config from '../config.json';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lobby.name, schema: LobbySchema }]),
    MongooseModule.forRoot(config.mongodbUri),
  ],
  controllers: [AppController],
  providers: [AppService, DiscordService, LobbyCommand],
  exports: [DiscordService],
})
export class AppModule {}
