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
    let lobby = lobbies.find((l) =>
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
      // Obtain the information channel to send the successful pick to.
      const iLobby = await LobbyCommand.service.getInternalLobbyById(lobby._id);
      const info = await LobbyCommand.discordService.createInfoChannel(
        iLobby,
        lobby.queuedPlayers,
        true,
      );

      // Is this captain's turn to pick?
      if (
        iLobby.captainPicks.picks[iLobby.captainPicks.position] !==
        interaction.user.id
      )
        return await interaction.editReply({
          content:
            ":x: Failed to perform pick: ``It's not your turn to pick.``",
        });

      if (iLobby.captainPicks.position >= iLobby.captainPicks.picks.length)
        return await interaction.editReply({
          content:
            ':x: Failed to perform pick: `The picking process has finished.`',
        });

      iLobby.captainPicks.position += 1;
      iLobby.markModified('captainPicks');
      await iLobby.save();

      // Send pick request.
      lobby = await LobbyCommand.service.performPick(lobby._id, pick);

      const emoji = LobbyCommand.messaging.getRequirementEmoji(role, true),
        roleName = LobbyCommand.messaging.getRequirementDisplayName(role),
        { position, picks } = iLobby.captainPicks;

      await info.send({
        content: `<@${player}> has been picked as ${emoji} **${roleName}** by <@${
          interaction.user.id
        }>!\n\n${
          position < picks.length
            ? `<@${picks[position]}> is picking next. `
            : ''
        }**${picks.length - position}** picks remaining.`,
      });

      // Are the picks finished?
      if (position >= picks.length) {
        // Determine which are the unfilled roles for each team to assign the captains to that role.
        const remainingA = captains.getAvailableRoles(null, lobby, 'team_a'),
          remainingB = captains.getAvailableRoles(null, lobby, 'team_b');
        const [capA, capB] = captains.getCurrentCaptains(lobby.queuedPlayers);

        this.logger.debug(remainingA, remainingB);

        // Since there is always going to be 2 remaining roles, assing these to the captains.
        await LobbyCommand.service.addRole(
          lobby._id,
          capA,
          `red-${remainingA[0]}`,
        );
        await LobbyCommand.service.addRole(lobby._id, capA, remainingA[0]);
        await LobbyCommand.service.addRole(
          lobby._id,
          capB,
          `blu-${remainingB[0]}`,
        );
        lobby = await LobbyCommand.service.addRole(
          lobby._id,
          capB,
          remainingB[0],
        );

        // Send the captains the roles they have been assigned.
        await info.send({
          content: `:white_check_mark: All picks are now finished! Captains have been automatically assigned a role. Lobby will start shortly...`,
        });
      }

      // Success.
      await LobbyCommand.messaging.updateReply(
        lobby,
        await LobbyCommand.discordService.getMessage(
          iLobby.messageId,
          iLobby.channels.general.textChannelId,
        ),
        config.formats.find((f) => f.name === iLobby.format) as LobbyFormat,
      );

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
