import { Logger } from '@nestjs/common';
import { CommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { LobbyCommand } from '../lobby.command';

import * as config from '../../../config.json';
import { LobbyFormat } from 'src/objects/lobby-format.interface';

@Discord()
@SlashGroup('lobby')
export class KickSubCommand {
  private readonly logger: Logger = new Logger(KickSubCommand.name);

  @Slash('kick', {
    description: 'Kicks a queued player from your Lobby.',
  })
  async kick(
    @SlashOption('player', {
      required: true,
      type: 'USER',
    })
    user: GuildMember,
    @SlashOption('reason', {
      required: false,
    })
    reason: string,
    interaction: CommandInteraction,
  ) {
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Check if the passed user is inside their Lobby
    const { lobbies } = await LobbyCommand.service.getActiveLobbies();

    let lobby = lobbies.find(
      (lobby) => lobby.createdBy === interaction.user.id,
    );

    // If no Lobby was found return said error.
    if (!lobby)
      return await interaction.editReply({
        content: `❌ You do not own any active Lobbies.`,
      });

    if (lobby.queuedPlayers.find((player) => player.discord === user.id)) {
      try {
        // Kick them
        lobby = await LobbyCommand.service.removePlayer(user.id, lobby._id);

        // Get the Lobby's attached message
        const iLobby = await LobbyCommand.service.getInternalLobbyById(
          lobby._id,
        );

        const channel = (await interaction.guild.channels.fetch(
            iLobby.channels.general.textChannelId,
          )) as TextChannel,
          message = await channel.messages.fetch(iLobby.messageId);

        // Update the Lobby's embed
        await LobbyCommand.messaging.updateReply(
          lobby,
          message,
          config.formats.find((f) => f.name === iLobby.format) as LobbyFormat,
        );

        // Send a success message to the kicker and one telling the kicked player.
        await channel.send({
          content: `<@${user.id}> has been kicked from Lobby **${
            iLobby.name
          }**. ${reason ? `Reason: \`\`${reason}\`\`` : ''}`,
        });

        return await interaction.editReply({
          content: `✅ Successfully kicked <@${user.id}> (${user.displayName}) from the Lobby.`,
        });
      } catch (e) {
        this.logger.error(e);
        return await interaction.editReply({
          content: `❌ An error occured while kicking the player.`,
        });
      }
    }
    // Player wasn't found in the Lobby, return an error message telling the user so
    else
      return await interaction.editReply({
        content:
          user.id !== interaction.client.user.id
            ? `❌ That player is not queued up into your Lobby.`
            : `❌ Really funny, but no, I only manage your Lobby for you to be trying to kick me.`,
      });
  }
}
