import { ButtonInteraction } from 'discord.js';
import { Discord, SlashGroup } from 'discordx';
import { Logger, Module } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { MessagingService } from 'src/messaging.service';
import { CreateSubCommand } from './lobby/create.command';
import { CloseSubCommand } from './lobby/close.command';
import { StatusSubCommand } from './lobby/status.command';
import { TeamRoleBasedHandler } from './lobby/distribution-handlers/team-role-based.handler';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
@Module({
  exports: [
    CreateSubCommand,
    CloseSubCommand,
    StatusSubCommand,

    TeamRoleBasedHandler,
  ],
})
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  static service: LobbyService;
  static messaging: MessagingService;

  constructor(
    private readonly service: LobbyService,
    private readonly messaging: MessagingService,
  ) {
    LobbyCommand.service = service;
    LobbyCommand.messaging = messaging;
  }

  /**
   * Gets the Lobby object from the command reply.
   */
  static async getLobbyFromInteraction(
    interaction: ButtonInteraction,
    lobbyId,
  ) {
    // Find the lobby with this ID.
    const lobby = await LobbyCommand.service.getLobbyById(lobbyId);

    // If the lobby wasn't found, change the message into an error one.
    if (!lobby) {
      interaction.update({
        content: '❌ Lobby not found: must have expired or been deleted.',
      });
      return;
    }

    return lobby;
  }
}
