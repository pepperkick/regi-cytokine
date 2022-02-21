import { Logger } from '@nestjs/common';
import { CommandInteraction, SelectMenuInteraction } from 'discord.js';
import { Discord, SelectMenuComponent, Slash, SlashGroup } from 'discordx';
import * as config from '../../../config.json';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { LobbyCommand } from '../lobby.command';

@Discord()
@SlashGroup('lobby')
export class CloseSubCommand {
  private readonly logger: Logger = new Logger(CloseSubCommand.name);

  // close
  // Closes a lobby whose match isn't in a LIVE, FINISHED, UNKNOWN state.
  @Slash('close', { description: 'Close a running lobby (Active).' })
  async close(interaction: CommandInteraction) {
    // Get the list of lobbies that have been created by this client AND are active.
    let { lobbies } = await LobbyCommand.service.getActiveLobbies();

    // Is this user not an admin?
    const adminMode = config.discord.channels.admin === interaction.channel.id;
    if (!adminMode) {
      // Filter lobbies out from the list that this user hasn't created.
      lobbies = lobbies.filter(
        (lobby) => lobby.createdBy === interaction.user.id,
      );
    }

    // If there are no lobbies, return a message saying so.
    if (!lobbies.length)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        ":x: There are no active Lobbies currently, or you don't own one.",
        { ephemeral: true },
      );

    if (adminMode) {
      // Add the name property to every lobby.
      for await (const lobby of lobbies) {
        const { name } = await LobbyCommand.service.getInternalLobbyById(
          lobby._id,
        );
        lobby.name = name;
      }

      // If there are lobbies, send a message to the interaction with a list of lobbies in a select menu.
      const component = LobbyCommand.messaging.createLobbySelectMenu(lobbies);

      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `<@${interaction.user.id}> Select a lobby you wish to close. ${
          adminMode ? '**[Admin Mode]**' : ''
        }`,
        { ephemeral: true, components: [component] },
      );
    } else {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Close the user's lobby
      const lobbyId = lobbies[0]._id;

      // TODO: Reduce duplicate code
      const e = await LobbyCommand.service.closeLobby(lobbyId);

      if (e?.error)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `:x: Failed to close lobby: \`\`${e.message}\`\``,
          { ephemeral: true },
        );

      // Log the closing action
      this.logger.log(
        `User ${interaction.user.username}#${interaction.user.discriminator} closed Lobby '${lobbyId}'`,
      );

      // Edit the interaction and send it back to the user.
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `:white_check_mark: Lobby '**${lobbyId}**' closed successfully.`,
        { ephemeral: true, components: [] },
      );
    }
  }

  /**
   * Lobby Close Select Handler
   */
  @SelectMenuComponent(InteractionType.LOBBY_CLOSE)
  async handleLobbyCloseSelect(interaction: SelectMenuInteraction) {
    try {
      // Defer reply
      await interaction.deferReply({ ephemeral: true });

      // Sugar syntax
      const lobbyId = interaction.values?.[0];

      // Send request to close the match to Cytokine.
      await LobbyCommand.service.closeLobby(lobbyId);

      // Log the closing action
      this.logger.log(
        `User ${interaction.user.username}#${interaction.user.discriminator} closed Lobby '${lobbyId}'`,
      );

      // Edit the interaction and send it back to the user.
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `:white_check_mark: Lobby '**${lobbyId}**' closed successfully.`,
        { components: [], ephemeral: true },
      );
    } catch (e) {
      this.logger.error(`Error closing lobby: ${e}`);
    }
  }
}
