import { Logger } from '@nestjs/common';
import { Message, SelectMenuInteraction } from 'discord.js';
import { Discord, SelectMenuComponent } from 'discordx';
import { LobbyCommand } from 'src/commands/lobby.command';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { LobbyFormat } from 'src/objects/lobby-format.interface';
import { Player } from 'src/objects/match-player.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';

import * as config from '../../../../config.json';

@Discord()
export class RandomisedHandler {
  private readonly logger: Logger = new Logger(RandomisedHandler.name);

  @SelectMenuComponent(InteractionType.ROLE_SELECT)
  async handleRole(interaction: SelectMenuInteraction) {
    // Player has selected their desired role (no team enforcement)
    await interaction.deferReply({ ephemeral: true });

    // Get our needed values to work with their selection.
    const [role, lobbyId] = interaction.values?.[0].split('|') ?? [];

    // Get the Lobby they're trying to queue in
    let lobby = await LobbyCommand.service.getLobbyById(lobbyId);

    // Lobby wasn't found? Reply with the error.
    if (!lobby)
      return await interaction.editReply({
        content: `:x: Failed to join this lobby: \`\`Could not find Lobby\`\``,
      });

    const internalLobby = await LobbyCommand.service.getInternalLobbyById(
      lobby._id,
    );

    // Get Kaiend data for their Steam profile. If they're not linked, it means they can't queue.
    const kaiend = await LobbyCommand.service.getKaiendAccount(
      interaction.user.id,
    );

    if (kaiend?.error || !kaiend?.steam)
      return await interaction.editReply({
        content: `:x: Failed to queue into lobby: \`\`${
          kaiend.message ??
          'Your Discord account does not have a valid Steam account linked.'
        }\`\`\n\nPlease link your **Steam** and **Discord** accounts here to proceed: <https://api.qixalite.com/accounts/login/discord>`,
      });

    // Add the player to the lobby
    const player: Player = {
      name: interaction.user.username,
      discord: interaction.user.id,
      steam: kaiend.steam,
      roles: [RequirementName.PLAYER, role as RequirementName],
    };

    if (
      !(await LobbyCommand.service.canPlayerJoinRole(
        internalLobby,
        player,
        RequirementName.PLAYER,
      ))
    )
      return await interaction.editReply({
        content: `:x: Failed to join the Lobby: \`\`You cannot join this lobby\`\``,
      });

    if (
      !(await LobbyCommand.service.canPlayerJoinRole(
        internalLobby,
        player,
        role as RequirementName,
      ))
    )
      return await interaction.editReply({
        content: `:x: Failed to join the Lobby: \`\`You cannot join ${role} role\`\``,
      });

    if (lobby.createdBy === interaction.user.id)
      player.roles.unshift(RequirementName.CREATOR);
    if (!lobby.data.afkCheck) player.roles.unshift(RequirementName.ACTIVE);

    try {
      lobby = await LobbyCommand.service.addPlayer(player, lobbyId);

      if (!lobby)
        return await interaction.editReply({
          content: `:x: Failed to queue you into the Lobby: \`\`The role you're trying to queue as is already taken/full.\`\``,
        });

      // Update the Lobby's embed to reflect the new roles
      await LobbyCommand.messaging.updateReply(
        lobby,
        interaction.message as Message,
        config.formats.find(
          (f) => f.name === internalLobby.format,
        ) as LobbyFormat,
      );

      return await interaction.editReply({
        content: `<@${interaction.user.id}> You've been added to the queue.`,
      });
    } catch (e) {
      this.logger.error(e);
      return await interaction.editReply({
        content: `<@${interaction.user.id}> Failed to queue you into the Lobby: This role is full, you're already queued as this role or something went wrong.`,
      });
    }
  }
}
