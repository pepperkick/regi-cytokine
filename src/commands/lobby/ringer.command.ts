import { Logger } from '@nestjs/common';
import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  InteractionCollector,
  Message,
  MessageActionRow,
  MessageButton,
  TextChannel,
} from 'discord.js';
import {
  ButtonComponent,
  Discord,
  Slash,
  SlashGroup,
  SlashOption,
} from 'discordx';
import { LobbyStatus } from 'src/modules/lobby/lobby-status.enum';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { Player } from 'src/objects/match-player.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';
import { arrayBuffer } from 'stream/consumers';
import { LobbyCommand } from '../lobby.command';

@Discord()
@SlashGroup('lobby')
export class RingerSubCommand {
  private readonly logger: Logger = new Logger(RingerSubCommand.name);

  @Slash('ringer', {
    description:
      "Asks on the Lobby's Discord Channel for a player substitute on a running Lobby.",
  })
  async ringer(
    @SlashOption('player', {
      description: 'The player that needs a substitute.',
      autocomplete: true,
      required: true,
      type: 'STRING',
    })
    player: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    // This can only be ran for a Lobby in a LIVE match.
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();

    // This is only ran by the Lobby creator.
    const lobby = lobbies.find(
      (lobby) => lobby.createdBy === interaction.user.id,
    );

    // Fill up the list of players on the active Lobby.
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'player': {
          // If no lobby has been found, maintain it empty.
          if (!lobby) return await interaction.respond([]);

          // Map the Lobby players to a list showing the player's name and their role.
          const players = lobby.queuedPlayers.map((player) => {
            const role = player.roles.filter((r) =>
              LobbyCommand.isClassRole(r),
            )[0];

            return {
              name: `${
                player.name
              } (${LobbyCommand.messaging.getRequirementDisplayName(role)})`,
              value: player.discord,
            };
          });

          return await interaction.respond(players);
        }
      }
    } else {
      // Defer reply.
      await interaction.deferReply({ ephemeral: true });

      // There has to be exactly ONE lobby created by the command runner to work with this.
      if (lobbies.length < 1)
        return await interaction.editReply({
          content: `:x: There are currently no active lobbies.`,
        });

      // Can only be ran by the Lobby creator
      if (!lobby || lobby.status != LobbyStatus.DISTRIBUTED)
        return await interaction.editReply({
          content: `:x: You don't own any active lobbies. ${
            lobby.status == LobbyStatus.DISTRIBUTED
              ? 'The Lobby you own did not start yet'
              : ''
          }`,
        });

      // Do not allow to call this command if one player is already requiring a substitute.
      const needs = lobby.queuedPlayers.find((p) =>
        p.roles.includes(RequirementName.NEEDS_SUB),
      );
      if (needs)
        return await interaction.editReply({
          content: `:x: You cannot ask for another substitute while another player is already asking for one.`,
        });

      // Declare the player we're replacing.
      const toReplace = lobby.queuedPlayers.find((p) => p.discord === player);

      // Declare the role we're substituting.
      const role = toReplace.roles.filter((r) =>
        LobbyCommand.isClassRole(r),
      )[0];

      // Create a message on the Lobby's general channel for a ringer to show up.
      const { channels, name } =
        await LobbyCommand.service.getInternalLobbyById(lobby._id);

      const channel = (await interaction.guild.channels.fetch(
          channels.general.textChannelId,
        )) as TextChannel,
        roleName = LobbyCommand.messaging.getRequirementDisplayName(role);

      // Add the "NEEDS_SUB" role to the player to identify them.
      const r = await LobbyCommand.service.addRole(
        lobby._id,
        player,
        RequirementName.NEEDS_SUB,
      );

      if (!r) {
        this.logger.error(r);
        return await interaction.editReply({
          content: `:x: Failed to ask for substitute. Ask an administrator for help.`,
        });
      }

      await channel.send({
        content: `@here\n\n:warning: A substitute player is required for **${roleName}** ${
          needs ? `(occupied by <@${needs.discord}>)` : ''
        } in Lobby **${name}**.\nClick the button below to join the Lobby as this role.`,
        components: [
          new MessageActionRow({
            components: [
              new MessageButton({
                label: `Join as ${roleName}`,
                customId: InteractionType.PLAYER_SUB,
                style: 'PRIMARY',
              }),
            ],
          }),
        ],
      });

      return await interaction.editReply({
        content: `:white_check_mark: Successfully asked for a substitute.`,
      });
    }
  }

  @ButtonComponent(InteractionType.PLAYER_SUB)
  async handleSub(interaction: ButtonInteraction) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get the Lobby from this interaction.
      const { lobbyId, messageId, channels } =
        await LobbyCommand.service.getInternalLobbyByChannel(
          interaction.channel.id,
        );

      // Get the player Discord ID we're substituting.
      let lobby = await LobbyCommand.service.getLobbyById(lobbyId);
      const needs = lobby.queuedPlayers.find((p) =>
        p.roles.includes(RequirementName.NEEDS_SUB),
      );

      if (!needs || needs.length < 1)
        return await interaction.editReply({
          content: `:x: There is no player needing a substitute in this Lobby.`,
        });

      // Do not allow the same player to substitute themselves
      if (needs?.discord === interaction.user.id)
        return await interaction.editReply({
          content: `:x: You cannot substitute yourself!`,
        });

      // Get the Kaiend entry for this user
      const kaiend = await LobbyCommand.service.getKaiendAccount(
        interaction.user.id,
      );

      if (kaiend?.error)
        return await interaction.editReply({
          content: `:x: Failed to process your substitute request: \`\`${kaiend.message}\`\`\n\nPlease link your **Steam** and **Discord** accounts here to proceed: <https://api.qixalite.com/accounts/login/discord>`,
        });

      // Create the player's entry.
      // Remove the "NEEDS_SUB" role from the player (if the lobby creator was the one being substituted the sub inherits their role, this is intentional).
      needs.roles = needs.roles.filter((r) => r != RequirementName.NEEDS_SUB);
      const player: Player = {
        name: interaction.user.username,
        discord: kaiend.discord,
        steam: kaiend?.steam,
        roles: [...needs.roles],
      };

      // Substitute them.
      lobby = await LobbyCommand.service.substitutePlayer(
        lobbyId,
        needs,
        player,
      );

      // Everything went well, update the reply with the new queued Players.
      const lobbyMessage = await interaction.channel.messages.fetch(messageId);
      await LobbyCommand.messaging.updateReply(lobby, lobbyMessage);

      // Update the message to reflect the successful substitution, and remove the button.
      await (interaction.message as Message).edit({
        content: `:white_check_mark: <@${needs.discord}> has been substituted for <@${player.discord}>.`,
        components: [],
      });

      const voice = player.roles.includes(RequirementName.TEAM_A)
          ? channels.teamA?.voiceChannelId
          : channels.teamB?.voiceChannelId,
        text = player.roles.includes(RequirementName.TEAM_A)
          ? channels.teamA?.textChannelId
          : channels.teamB?.textChannelId;
      return await interaction.editReply({
        content: `:white_check_mark: You have substituted **${needs.name}** successfully!\n\nThese are your team's channels:\n:loudspeaker: <#${voice}>\n:speech_balloon: <#${text}>.`,
      });
    } catch (e) {
      this.logger.error(
        `Couldn't handle substitute for player ${interaction.user.id}: ${e}`,
      );
      return await interaction.editReply({
        content: `:x: An error occurred while trying to handle your substitute request. Contact an administrator.`,
      });
    }
  }
}
