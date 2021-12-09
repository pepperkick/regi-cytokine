import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Lobby, LobbySchema } from './modules/lobby/lobby.model';

import axios from 'axios';
import { Client } from 'discordx';

export class LobbyService {
  private currentLobby: Model<Lobby>;
  private readonly logger = new Logger(LobbyService.name);

  constructor(
    @InjectModel(Lobby.name)
    private readonly lobby: Model<Lobby>,
    private readonly bot: Client,
  ) {
    this.currentLobby = lobby;
  }

  
}
