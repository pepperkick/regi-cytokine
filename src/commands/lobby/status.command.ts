import { Logger } from '@nestjs/common';
import { CommandInteraction, MessageEmbed } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { LobbyCommand } from '../lobby.command';
import * as config from '../../../config.json';

@Discord()
@SlashGroup('lobby')
export class StatusSubCommand {
  private readonly logger: Logger = new Logger(StatusSubCommand.name);

  // status
  // This sub-command is ran only on the admin channel.
  // Lists all active lobbies, and being passed the ID of a lobby to get specific information.
  @Slash('status', {
    description: 'Lists all active lobbies or specific information on one.',
  })
  async status(
    @SlashOption('lobby', {
      description: 'Lobby ID to get information on.',
      required: false,
    })
    lobbyId: string,
    interaction: CommandInteraction,
  ) {
    await interaction.deferReply();

    // If this wasn't sent on the admin channel ignore it
    if (interaction.channel.id !== config.discord.channels.admin)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `❌ This command can only be used by administrators.`,
        { ephemeral: true },
      );

    // Get all active lobbies
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();

    // None found?
    if (lobbies.length < 1)
      return await LobbyCommand.messaging.replyToInteraction(
        interaction,
        `❌ No active lobbies found.`,
        { ephemeral: true },
      );

    // If an ID was passed, get the lobby with that ID.
    if (lobbyId?.length > 0) {
      const lobby = lobbies.find((lobby) => lobby._id === lobbyId);

      // If it wasn't found return an error message.
      if (!lobby)
        return await LobbyCommand.messaging.replyToInteraction(
          interaction,
          `❌ Lobby not found: must have expired or been deleted.`,
          { ephemeral: true },
        );

      // Get all necessary information.
      const iLobby = await LobbyCommand.service.getInternalLobbyById(lobbyId),
        match = await LobbyCommand.service.getMatchById(lobby.match),
        server = await LobbyCommand.service.getServerInfo(lobby.match);

      // Send a response message with the lobby information.
      return await interaction.editReply(
        await LobbyCommand.messaging.buildLobbyStatusEmbed(
          false,
          [],
          lobby,
          iLobby,
          match,
          server,
        ),
      );
    }

    // If not, return all active lobbies.
    return await interaction.editReply(
      await LobbyCommand.messaging.buildLobbyStatusEmbed(true, lobbies),
    );
  }
}
