import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { LobbyCommand } from './commands/lobby.command';
import { DiscordService } from './discord.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, DiscordService, LobbyCommand],
  exports: [DiscordService],
})
export class AppModule {}
