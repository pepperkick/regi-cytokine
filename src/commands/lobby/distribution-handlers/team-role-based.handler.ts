import { Logger } from '@nestjs/common';
import { Message, SelectMenuInteraction } from 'discord.js';
import { Discord, SelectMenuComponent } from 'discordx';
import { LobbyCommand } from 'src/commands/lobby.command';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { Player } from 'src/objects/match-player.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';

/**
 * Purpose: This file manages the team role based distribution of roles on a Lobby with set distribution method.
 *
 * Handles queuing players to a lobby of this type.
 */
@Discord()
export class TeamRoleBasedHandler {
  private readonly logger: Logger = new Logger(TeamRoleBasedHandler.name);

  @SelectMenuComponent(InteractionType.TEAM_ROLE_SELECT)
  async handleTeamRoleSelect(interaction: SelectMenuInteraction) {
    // A player has selected a role and a team.
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Sugar syntax (yes, don't worry lmao)
    const [role, lobbyId] = interaction.values?.[0].split('|') ?? [];

    // Get the lobby
    let lobby = await LobbyCommand.service.getLobbyById(lobbyId);

    // Did we find the lobby?
    if (!lobby)
      return await interaction.editReply({
        content: `:x: Failed to join the Lobby: \`\`Could not find Lobby\`\``,
      });

    // Get Kaiend data for their Steam profile. If they're not linked, it means they can't queue.
    const kaiend = await LobbyCommand.service.getKaiendAccount(
      interaction.user.id,
    );

    if (kaiend?.error)
      return await interaction.editReply({
        content: `:x: Failed to queue into lobby: \`\`${kaiend.message}\`\`\n\nPlease link your **Steam** and **Discord** accounts here to proceed: <https://api.qixalite.com/accounts/login/discord>`,
      });

    // Add the player to the lobby
    const player: Player = {
      name: interaction.user.username,
      discord: interaction.user.id,
      steam: kaiend.steam,
      roles: [RequirementName.PLAYER, role as RequirementName],
    };

    if (lobby.createdBy === interaction.user.id)
      player.roles.unshift(RequirementName.CREATOR);
    if (!lobby.data.afkCheck) player.roles.unshift(RequirementName.ACTIVE);

    try {
      lobby = await LobbyCommand.service.addPlayer(player, lobbyId);

      // Update the Lobby's embed to reflect the new roles
      await LobbyCommand.messaging.updateReply(
        lobby,
        interaction.message as Message,
      );

      return await interaction.editReply({
        content: `<@${interaction.user.id}> You've been added to the queue.`,
      });
    } catch (e) {
      this.logger.error(e);
      return await interaction.editReply({
        content: `<@${interaction.user.id}> Failed to queue you into the Lobby: Either this role is full or something went wrong with the service.`,
      });
    }
  }
}
