import { Injectable, Logger } from '@nestjs/common';
import { Interaction, MessageComponentInteraction } from 'discord.js';
import { Lobby } from './modules/lobby/lobby.model';
import { LobbyFormat } from './objects/lobby-format.interface';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor() {}

  /**
   * Reply to an interaction with the correct embed format.
   *
   * @param interaction The interaction to reply to.
   * @param format The lobby format used to create the lobby.
   * @param lobby The lobby object.
   *
   * @return The sent message.
   */
  async lobbyReply(
    interaction: Interaction | MessageComponentInteraction,
    format: LobbyFormat,
    lobby: Lobby,
  ) {
      // TODO: Implement
  }
}
