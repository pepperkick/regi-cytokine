import { Logger } from '@nestjs/common';
import { Message, SelectMenuInteraction } from 'discord.js';
import { Discord, SelectMenuComponent } from 'discordx';
import { LobbyCommand } from 'src/commands/lobby.command';
import { InteractionType } from 'src/objects/interactions/interaction-types.enum';
import { Player } from 'src/objects/match-player.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';
import { CaptainSelection } from './captain-selection.interface';

import * as config from '../../../../config.json';
import { LobbyFormat } from 'src/objects/lobby-format.interface';
import { LobbyPick } from 'src/modules/lobby/lobby-pick.interface';

/**
 * Handles the captain selection phase of the distribution.
 * This only controls user inputs for the picking process and ensures the backend receives the memo. Validation is mostly done in Cytokine.
 */
@Discord()
export class CaptainBasedHandler {
  private readonly logger: Logger = new Logger(CaptainBasedHandler.name);

  constructor() {}

  /**
   * Performs a pick.
   * @param lobby The lobby to perform the pick in.
   * @param pick The pick to perform.
   * @param issuer The Discord User ID of the issuer of the pick.
   * @param expired If true, the pick has expired and will be announced as so.
   *
   * @returns True if successful, if not a string indicating the error.
   */
  async pickPlayer(
    lobby: any,
    pick: LobbyPick,
    issuer: string,
    expired = false,
  ): Promise<true | string> {
    // Obtain the information channel to send the successful pick to.
    const iLobby = await LobbyCommand.service.getInternalLobbyById(lobby._id);
    const info = await LobbyCommand.discordService.createInfoChannel(
      iLobby,
      lobby.queuedPlayers,
      true,
    );

    const { role, player } = pick.pick;

    // Is this captain's turn to pick?
    if (iLobby.captainPicks.picks[iLobby.captainPicks.position] !== issuer)
      return `It's not your turn to pick.`;

    if (iLobby.captainPicks.position >= iLobby.captainPicks.picks.length)
      return `The picking process has finished.`;

    try {
      // Send pick request.
      lobby = await LobbyCommand.service.performPick(lobby._id, pick);
    } catch (e) {
      this.logger.error(`Failed to perform pick: ${e}`);
    }

    // Update the internal Lobby document to reflect the new pick.
    iLobby.captainPicks.position += 1;

    // Set the lobby pick expiry date.
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + config.lobbies.captainPickTimeout);

    iLobby.captainPicks.pickExpires = expiry;

    const captains = new CaptainBasedHandler();

    const emoji = LobbyCommand.messaging.getRequirementEmoji(role, true),
      roleName = LobbyCommand.messaging.getRequirementDisplayName(role),
      { position, picks } = iLobby.captainPicks;

    await info.send({
      content: `${
        expired
          ? `**Your pick time has expired, this pick is automatic.** `
          : ''
      }<@${player}> has been picked as ${emoji} **${roleName}** by <@${issuer}>!\n\n${
        position < picks.length ? `<@${picks[position]}> is picking next. ` : ''
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

      iLobby.captainPicks.pickExpires = null;

      // Send the captains the roles they have been assigned.
      await info.send({
        content: `:white_check_mark: All picks are now finished! Captains have been automatically assigned a role. Lobby will start shortly...`,
      });
    }

    // Success.
    iLobby.markModified('captainPicks');
    await iLobby.save();

    await LobbyCommand.messaging.updateReply(
      lobby,
      await LobbyCommand.discordService.getMessage(
        iLobby.messageId,
        iLobby.channels.general.textChannelId,
      ),
      config.formats.find((f) => f.name === iLobby.format) as LobbyFormat,
    );

    return true;
  }

  /**
   * Gets the current captains in a Lobby, or null if not selected yet.
   * @param players The currently queued players in the Lobby.
   * @returns The captains in the Lobby (TEAM_A on index 0 and TEAM_B on index 1), or null if not selected yet.
   */
  getCurrentCaptains(players: any[]): null | [string, string] {
    // Get the captains.
    const capA = players.find((p) => p.roles.includes('captain-a')),
      capB = players.find((p) => p.roles.includes('captain-b'));

    // Return the captains.
    return capA && capB ? [capA.discord, capB.discord] : null;
  }

  /**
   * Finds players in a Lobby which are available to be picked.
   * @param lobby The Cytokine Lobby document.
   * @returns An Array with all players which are available to be picked.
   */
  getPickeablePlayers(lobby: any): any[] {
    return lobby.queuedPlayers.filter(
      (p) =>
        !p.roles.includes('picked') &&
        !p.roles.includes('captain-a') &&
        !p.roles.includes('captain-b'),
    );
  }

  /**
   * Gets the available roles to pick from a queued player.
   * @param player The queued player.
   * @param lobby The Cytokine Lobby document.
   * @param team If not null, will return available roles for a specific team.
   * @returns An Array of roles which are available to be picked.
   */
  getAvailableRoles(
    player: Player | any,
    lobby: any,
    team: null | 'team_a' | 'team_b' = null,
  ): string[] {
    // List the roles this player had queued as, in comparison to the ones already occupied.
    const occupied = {
      scout: 0,
      soldier: 0,
      pyro: 0,
      demoman: 0,
      heavy: 0,
      engineer: 0,
      medic: 0,
      sniper: 0,
      spy: 0,
    };

    // If we have a team check return all remaining roles for that specific team.
    if (team !== null) {
      // Get all occupied roles currently, since it's for a single team we'll divide them by 2.
      const status = {};
      for (const role of Object.keys(occupied)) {
        const requirement = lobby.requirements.find((r) => r.name === role);

        this.logger.debug(requirement);

        // Assign the amount
        if (requirement) {
          // Required amount of this role for this team.
          const required = Math.floor(requirement.count / 2);

          // Get the amount of this role for this team, substract the required amount to get how many are left available.
          const teamPlayers = lobby.queuedPlayers.filter((p) =>
            p.roles.includes(team),
          );

          this.logger.debug(teamPlayers);

          const taken = teamPlayers.filter((p) =>
            p.roles.includes(role),
          ).length;

          // Assign this to the status.
          status[role] = required - taken;
        }

        this.logger.debug(status);
      }

      return Object.keys(status)
        .filter((s) => status[s] > 0)
        .map((s) => s);
    }

    // If not a team specific check, return occupied roles who had been picked.
    for (const player of lobby.queuedPlayers) {
      for (const role of Object.keys(occupied)) {
        if (player.roles.includes(role) && !player.roles.includes('picked'))
          occupied[role] += 1;
      }
    }

    // Roles the player queued up for.
    const queued = player.roles.filter((r) =>
      Object.keys(occupied).includes(r),
    );

    // Now list the roles that can be selected for this player.
    return queued.filter((r) => occupied[r] > 0);
  }

  /**
   * Assigns the remaining roles to both captains after the pick process has finished.
   * @param lobby The Cytokine Lobby document.
   * @noreturn
   */
  async assignRemainingRoles(lobby: any) {
    // Get the captains.
    const capA = lobby.queuedPlayers.find((p) => p.roles.includes('captain-a')),
      capB = lobby.queuedPlayers.find((p) => p.roles.includes('captain-b'));

    // Find unfilled roles (pickeable)
    // Get the players in the lobby
    const players = this.getPickeablePlayers(lobby);
  }

  /**
   * Validates the requirements on a lobby and returns if they're minimally met.
   * Source: Written by PepperKick on Cytokine to verify required players.
   *
   * @param lobby The Cytokine Lobby document.
   * @returns True if the lobby has its requirements met, false if not.
   */
  validateRequirements(lobby: any) {
    // Get the players and the Lobby's requirements.
    const players = lobby.queuedPlayers,
      requirements = lobby.requirements;
    const count = {};

    // Create a list of roles and the amount of players in it.
    players.forEach((item) => {
      item.roles.forEach((role) => {
        count[role] ? count[role]++ : (count[role] = 1);
      });
    });

    // Declare unfilled and overfilled roles (if allowed to be overfilled).
    const unfilled = requirements.filter((item) => {
        return count[item.name] ? count[item.name] < item.count : true;
      }),
      overfilled = requirements.filter(
        (item) => count[item.name] > item.count && !item.overfill,
      );

    // Check if requirements met are valid (overfilled roles only if allowed to, and all roles taken)
    if (lobby.distribution == 'CAPTAIN_BASED')
      return (
        unfilled.length === 0 &&
        overfilled.length === 0 &&
        lobby.queuedPlayers.length >= lobby.maxPlayers
      );
    return unfilled.length === 0 && overfilled.length === 0;
  }

  @SelectMenuComponent(InteractionType.ROLE_SELECT_CAPTAINS)
  async handleRoleSelection(interaction: SelectMenuInteraction) {
    // All roles in this type of Lobby require overfill. So we ignore logical overfills (duh)
    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Get info from selections.
    const roles = interaction.values.map(
      (r) => r.split('|')[0] as RequirementName,
    );
    const lobbyId = interaction.values[0]?.split('|')[1];

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
      roles: [RequirementName.PLAYER, ...roles],
    };

    // Verify if player can queue at all in this Lobby.
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

    // Verify if player is blacklisted from any of the following roles they've selected.
    const invalid = [];
    for (const role of roles) {
      if (
        !(await LobbyCommand.service.canPlayerJoinRole(
          internalLobby,
          player,
          role as RequirementName,
        ))
      )
        invalid.push(role);
    }

    if (invalid.length)
      return await interaction.editReply({
        content: `:x: Failed to join the Lobby: \`\`You are blacklisted from playing the following roles: ${invalid
          .map((r) => `${LobbyCommand.messaging.getRequirementDisplayName(r)}`)
          .join(', ')}\`\``,
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

      await LobbyCommand.messaging.updateReply(
        lobby,
        interaction.message as Message,
        config.formats.find(
          (f) => f.name === internalLobby.format,
        ) as LobbyFormat,
      );

      // Check if the lobby has its requirements met.
      if (this.validateRequirements(lobby) && !internalLobby.minimumAdverted) {
        // Get the amount of time before the Lobby actually begins the picking process.
        const timeout = +lobby.data.captainPickTimeout,
          timeLeft = `${
            timeout >= 60
              ? `${Math.floor(timeout / 60)} minutes${
                  timeout % 60 ? ` and ${timeout % 60} seconds` : ''
                }`
              : `${timeout} seconds`
          }`;

        // Send a message to the channel alerting players that the Lobby is about to start.
        await interaction.channel.send({
          content: `@here Lobby **${internalLobby.name}** is about to start!\n:hourglass: You have **${timeLeft}** before the Lobby starts to join.`,
        });

        internalLobby.minimumAdverted = true;
        internalLobby.markModified('minimumAdverted');
        await internalLobby.save();
      }

      return await interaction.editReply({
        content: `<@${interaction.user.id}> You've been added to the queue.`,
      });
    } catch (e) {
      this.logger.error(e);
      return await interaction.editReply({
        content: `<@${interaction.user.id}> Failed to queue you into the Lobby: Something really bad happened, contact Qixalite support to assist you.`,
      });
    }
  }

  /**
   * Handles a pick from a captain inside a Lobby.
   * @param lobby The Cytokine Lobby document.
   * @param selection Information about the pick made.
   *
   * @returns The updated Lobby document, or null if something went wrong.
   */
  public async handlePick(
    lobby: any,
    selection: CaptainSelection,
  ): Promise<any> {
    // Check if the captain is an actual captain inside the Lobby.
    if (!lobby.queuedPlayers.find((p) => p.discord === selection.captain)) {
      this.logger.error(
        `${selection.captain} is not a captain in ${lobby.name}!`,
      );
      return null;
    }

    //
  }
}
