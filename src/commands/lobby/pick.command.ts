import { Logger } from '@nestjs/common';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { LobbyPick } from 'src/modules/lobby/lobby-pick.interface';
import { LobbyCommand } from '../lobby.command';

import * as config from '../../../config.json';
import { LobbyFormat } from 'src/objects/lobby-format.interface';
import { CaptainBasedHandler } from './distribution-handlers/captain.handler';

@Discord()
@SlashGroup('lobby')
export class PickSubCommand {
  private readonly logger: Logger = new Logger(PickSubCommand.name);

  /**
   * Autocomplete function for queued players in a Lobby.
   */
  static async getQueuedPlayers(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    // Get the Lobby this user is queued in (if any)
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();

    const lobby = lobbies.find((l) => {
      if (l.queuedPlayers.find((p) => p.discord === interaction.user.id))
        return l;
    });

    // Found?
    if (lobby) {
      const captains = new CaptainBasedHandler();
      const pickeablePlayers = captains.getPickeablePlayers(lobby);

      interaction.respond(
        pickeablePlayers.map((p) => {
          return {
            name: p.name,
            value: p.discord,
          };
        }),
      );
    }
  }

  @Slash('pick', {
    description: 'Picks a player inside your Lobby as a specific role.',
  })
  async pick(
    @SlashOption('player', {
      description: 'The player to pick.',
      required: true,
      type: 'STRING',
      autocomplete: PickSubCommand.getQueuedPlayers,
    })
    player: string,
    @SlashOption('role', {
      description: 'The role to pick this player as.',
      required: true,
      type: 'STRING',
      autocomplete: true,
    })
    role: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    // Get the Lobby we're working in.
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();
    const lobby = lobbies.find((l) =>
      l.queuedPlayers.find((p) => p.discord === interaction.user.id),
    );
    const captains = new CaptainBasedHandler();

    if (interaction instanceof AutocompleteInteraction) {
      // Are we on parameter 2?
      const focused = interaction.options.getFocused(true);

      if (focused.name === 'role') {
        // Found?
        if (lobby && player.length) {
          // Get the player in the Lobby
          const p = lobby.queuedPlayers.find((p) => p.discord === player);

          if (!p) return await interaction.respond([]);

          const availableRoles = captains.getAvailableRoles(p, lobby);

          interaction.respond(
            availableRoles.map((r) => {
              return {
                name: LobbyCommand.messaging.getRequirementDisplayName(r),
                value: r,
              };
            }),
          );
        }
      }

      return;
    }

    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    if (!lobby)
      return await interaction.editReply({
        content:
          ':x: Failed to perform pick: ``You are not queued in any lobby.``',
      });

    // Is the selected player a queued player?
    const qP = lobby.queuedPlayers.find((p) => p.discord === player);

    if (!qP)
      return await interaction.editReply({
        content:
          ':x: Failed to perform pick: ``The player you selected is not queued in your Lobby.``',
      });

    // Is the command runner a captain in this Lobby?
    const captain = lobby.queuedPlayers.find(
      (p) =>
        p.discord === interaction.user.id &&
        (p.roles.includes('captain-a') || p.roles.includes('captain-b')),
    );

    if (!captain)
      return await interaction.editReply({
        content:
          ':x: Failed to perform pick: ``You are not a captain in this lobby.``',
      });

    // Perform the pick.
    const pick: LobbyPick = {
      pick: {
        player,
        role,
      },
      captain: interaction.user.id,
    };

    try {
      const result = await captains.pickPlayer(
        lobby,
        pick,
        interaction.user.id,
      );

      if (typeof result === 'string')
        return await interaction.editReply({
          content: `:x: Failed to perform pick: \`${result}\``,
        });

      return await interaction.editReply({
        content: `:white_check_mark: Successfully picked ${player} as ${role}.`,
      });
    } catch (e) {
      this.logger.error(
        `Pick performed by ${interaction.user.id} failed: ${e}`,
      );
    }
  }
}
