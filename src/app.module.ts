import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbyModule } from './modules/lobby/lobby.module';
import { LobbyCommand } from './commands/lobby.command';

import * as config from '../config.json';
import { PreferenceModule } from './modules/preferences/preference.module';
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongodbUri),
    LobbyModule,
    PreferenceModule,
  ],
  controllers: [AppController],
  providers: [AppService, LobbyCommand, MessagingService],
  exports: [],
})
export class AppModule {}
