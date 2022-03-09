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
  async handleAFK(interaction: ButtonInteraction) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Check in which Lobby this player is queued in.
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();
    const lobby = lobbies.find((lobby) =>
      lobby.queuedPlayers.find(
        (player) => player.discord === interaction.user.id,
      ),
    );

    if (!lobby)
      return await interaction.editReply({
        content: `:x: You are not queued in this Lobby.`,
      });

    // If they've already marked they're not AFK, do not do anything.
    const oldiLobby = await LobbyCommand.service.getInternalLobbyById(
      lobby._id,
    );
    if (
      oldiLobby.afk.find(
        (player) => player.discord === interaction.user.id && !player.afk,
      )
    )
      return await interaction.editReply({
        content: `:x: You've already marked you're not AFK!`,
      });

    // Update the message with the new content.
    const iLobby = await LobbyCommand.service.updateAfkStatus(
      lobby._id,
      interaction.user.id,
      false,
    );

    const message = iLobby.afk
      .map(
        (afk) =>
          `${afk.afk ? ':hourglass:' : ':white_check_mark:'} <@${
            afk.discord
          }> (${afk.name})`,
      )
      .join('\n');

    const passed = iLobby.afk.filter((player) => player.afk).length === 0;

    const params = {
      content: passed
        ? `:white_check_mark: All players have passed the AFK check!\n${message}`
        : `:hourglass: **AFK Check**\n\nPlease confirm that you are not AFK by clicking on the button below.\n${message}`,
    };

    if (passed) {
      await LobbyCommand.service.sendAfkStatus(lobby._id, iLobby.afk);
      params['components'] = [];
    }

    await (interaction.message as Message).edit(params);

    // Tell the user they've successfully passed the AFK check.
    return await interaction.editReply({
      content: `:white_check_mark: Thanks for confirming!\nYou can close this message.`,
    });
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
