import { ButtonComponent, Discord, SlashGroup } from 'discordx';
import { Logger, Module } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { MessagingService } from 'src/messaging.service';
import { CreateSubCommand } from './lobby/create.command';
import { CloseSubCommand } from './lobby/close.command';
import { StatusSubCommand } from './lobby/status.command';
import { TeamRoleBasedHandler } from './lobby/distribution-handlers/team-role-based.handler';
import { KickSubCommand } from './lobby/kick.command';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { ButtonInteraction, Message } from 'discord.js';
import { DistributionType } from 'src/objects/distribution.enum';

import * as config from '../../config.json';
import { RandomisedHandler } from './lobby/distribution-handlers/randomised.handler';

@Discord()
@SlashGroup({
  name: 'lobby',
  description: 'Interact with lobby options.',
})
@Module({
  exports: [
    CreateSubCommand,
    CloseSubCommand,
    StatusSubCommand,
    KickSubCommand,

    RandomisedHandler,
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

  @ButtonComponent(InteractionType.AFK_CHECK)
  async handleAfk(interaction: ButtonInteraction) {
    // Defer the reply
    await interaction.deferReply({ ephemeral: true });

    // Check in which Lobby this player is queued in.
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();
    const lobby = lobbies.find((lobby) =>
      lobby.queuedPlayers.find(
        (player) => player.discord === interaction.user.id,
      ),
    );
    const player = lobby?.queuedPlayers.find(
      (p) => p.discord === interaction.user.id,
    );

    if (!lobby || !player)
      return await interaction.editReply({
        content: `:x: You are not queued in this Lobby.`,
      });

    // Are they already non-AFK?
    if (player.roles.includes('active'))
      return await interaction.editReply({
        content: `:x: You've already been marked as not AFK!`,
      });

    // Add their active role.
    try {
      const nLobby = await LobbyCommand.service.addRole(
        lobby._id,
        interaction.user.id,
        'active',
      );

      // Generate a player list string based on 'active' and non-active status.
      const playerList = nLobby.queuedPlayers
          .map(
            (p) =>
              `${
                p.roles.includes('active')
                  ? ':white_check_mark:'
                  : ':hourglass:'
              } <@${p.discord}> (${p.name})`,
          )
          .join('\n'),
        noAfk =
          nLobby.queuedPlayers.filter((p) => !p.roles.includes('active'))
            .length === 0;

      const message = {
        content: `:hourglass: **AFK Check** (:alarm_clock: ${(
          config.lobbies.afkCheckTimeout / 60
        ).toFixed(2)} minute(s))\n\n${
          noAfk
            ? "All players have confirmed they're here!"
            : 'Please confirm that you are not AFK by clicking on the button below.'
        }.\n${playerList}`,
      };

      // If all players are active, remove the I am not AFK button (a.k.a. the message's components).
      if (noAfk) message['components'] = [];

      // Edit the original message.
      await (interaction.message as Message).edit(message);

      // Send a confirmation one for the user who interacted.
      return await interaction.editReply({
        content: `:white_check_mark: Thanks for confirming! You may close this message.`,
      });
    } catch (e) {
      this.logger.error(e);
      return await interaction.editReply({
        content: `:x: Something went wrong while marking you as not AFK: ${e}`,
      });
    }
  }

  /**
   * Translates a Distribution Type to a readable name (for parameter display).
   * @param distribution The DistributionType to translate.
   * @returns A string representing the Distribution Type specified.
   */
  static getDistributionTypeName(distribution: DistributionType): string {
    switch (distribution) {
      case DistributionType.RANDOM:
        return 'Randomised';
      case DistributionType.TEAM_ROLE_BASED:
        return 'Open';
      case DistributionType.CAPTAIN_ROLE_PICK:
        return 'Captain';
      default:
        return 'Unknown Distribution';
    }
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
