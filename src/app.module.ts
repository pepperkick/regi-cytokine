import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbyModule } from './modules/lobby/lobby.module';
import { LobbyCommand } from './commands/lobby.command';

import * as config from '../config.json';
import { PreferenceModule } from './modules/preferences/preference.module';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongodbUri),
    LobbyModule,
    PreferenceModule,
  ],
  controllers: [AppController],
  providers: [AppService, LobbyCommand],
  exports: [],
})
export class AppModule {}
