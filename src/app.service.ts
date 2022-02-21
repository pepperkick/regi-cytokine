import { Injectable, Logger } from '@nestjs/common';
import { Message, TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { MessagingService } from './messaging.service';
import { LobbyService } from './modules/lobby/lobby.service';
import { Player } from './objects/match-player.interface';

import { StatusColors as color } from './objects/status-colors.enum';

@Injectable()
export class AppService {
  private readonly logger: Logger = new Logger(AppService.name);

  constructor(
    private lobbyService: LobbyService,
    private messagingService: MessagingService,
    private discordService: DiscordService,
  ) {}

  /**
   * Gets the Message object from a Lobby ID
   * @param lobbyId The lobby ID to get the message from
   */
  private async getMessage(lobbyId: string): Promise<{
    message: Message;
    discord: any;
  }> {
    // Get Lobby from the Lobby ID
    const discord = await this.lobbyService.getInternalLobbyById(lobbyId);

    // Update the message.
    const message = await this.discordService.getMessage(discord.messageId);

    return { message, discord };
  }

  /**
   * Updates the status of an internal Lobby document.
   * @param lobbyId The Lobby ID we're updating the status of.
   * @param status The status to set.
   * @noretun
   */
  async updateInternalLobby(lobbyId: string, status: string) {
    await this.lobbyService.updateLobbyStatus(lobbyId, status);
  }

  /**
   * Gets the Lobby object from a Match ID.
   * @param matchId The Match ID sent from Cytokine
   * @returns The lobby object that's linked with the provided matchId, if found.
   */
  async getLobbyFromMatchId(matchId: string) {
    return await this.lobbyService.getLobbyByMatchId(matchId);
  }

  /**
   * Does a Lobby Notification for DISTRIBUTING
   * Locks down queueing at this instance.
   */
  async lobbyNotifyDistributing(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    // And update the last field message, removing the queue up reminder.
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTING;

    // Remove the queue up message
    embed.fields.splice(embed.fields.length - 1, 1);

    return await message.edit({
      content: ':hourglass: Distributing players randomly...',
      embeds: [embed],
      components: [],
    });
  }

  /**
   * Does a Lobby Notification for DISTRIBUTED
   */
  async lobbyNotifyDistributed(lobby) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobby._id);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTED;

    // Get the user lists
    const players = await this.messagingService.generateUserList(lobby, {
        perTeam: true,
      }),
      // Create the team specific channels.
      { teamA, teamB } = await this.discordService.createTeamChannels(
        lobby.name,
        discord.channels.categoryId,
        discord.region,
      );

    // Check for the team specific channels being successfully created
    if (!teamA || !teamB) {
      // Edit the message
      await message.edit({
        content: `:warning: Couldn't create team channels due to a permissions error.\n\n:x: Closing lobby...`,
      });

      // Close the lobby
      return await this.lobbyService.closeLobby(lobby._id);
    }

    // Update the Internal Lobby document
    this.lobbyService.updateLobbyChannels(lobby._id, { A: teamA, B: teamB });

    // Create the embed fields with the team, classes (TODO) and channels displayed.
    // Remove queued players from the embed fields.
    delete embed.fields[3];

    // Add the new fields to the embed.
    embed.fields.splice(3, 0, {
      name: ':red_circle: Team A',
      value: `${
        players.A.length > 0
          ? players.A.map((user: Player) => `<@${user.discord}>`).join('\n')
          : 'Team is empty.'
      }\n\n<#${teamA.text.id}>\n<#${teamA.voice.id}>`,
      inline: true,
    });
    embed.fields.splice(4, 0, {
      name: ':blue_circle: Team B',
      value: `${
        players.B.length > 0
          ? players.B.map((user: Player) => `<@${user.discord}>`).join('\n')
          : 'Team is empty.'
      }\n\n<#${teamB.text.id}>\n<#${teamB.voice.id}>`,
      inline: true,
    });
    embed.fields.join();

    return await message.edit({
      content:
        ':white_check_mark: Players have been distributed!\n\n:hourglass: Preparing lobby...',
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for LOBBY_READY
   */
  async lobbyNotifyLobbyReady(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LOBBY_READY;

    return await message.edit({
      content:
        ':white_check_mark: Lobby is ready!\n\n:point_right: Join your respective team channels below.',
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby notification for CREATING_SERVER
   */
  async lobbyNotifyCreatingServer(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.CREATING_SERVER;

    return await message.edit({
      content: `${message.content}\n:hourglass: Waiting for server to start...`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for WAITING_FOR_PLAYERS
   * At this point:
   * - We have a live server in IDLE status.
   * - Everybody is queued and distributed accordingly.
   */
  async lobbyNotifyWaitingForPlayers(lobbyId: string, data) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.WAITING_FOR_PLAYERS;

    // Get the Server info from the server ID
    const server = await this.lobbyService.getServerInfo(data._id);

    // Find the general lobby channel.
    const client = await this.discordService.getClient();
    const lobbyChannel = <TextChannel>(
      await client.channels.fetch(discord.channels.general.textChannelId)
    );

    // Update the message and send connect data to the general channel.
    await this.discordService.sendServerDetails(lobbyChannel, server);

    return await message.edit({
      content: `:white_check_mark: Server is ready!\n\n:point_right: Details have been posted in <#${discord.channels.general.textChannelId}>\n:hourglass: Waiting for players to join...`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for LIVE
   */
  async lobbyNotifyLive(lobbyId: string, match: any) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LIVE;

    // Add the STV connection string to the embed
    // Get the Server info from the server ID
    const server = await this.lobbyService.getServerInfo(match._id);

    embed.fields.push({
      name: ':tv: STV Connection',
      value: `If you wish to spectate the match connect to the **STV** with: \`\`connect ${
        server.data.sdrEnable ? server.data.sdrIp : server.ip
      }:${
        server.data.sdrEnable ? server.data.sdrTvPort : server.data.tvPort
      }; ${
        server.data.tvPassword.length > 0
          ? `password ${server.data.tvPassword}`
          : ''
      }\`\``,
      inline: false,
    });

    return await message.edit({
      content:
        ":busts_in_silhouette: All players have joined the server!\n\n:crossed_swords: **It's game time! Good luck and happy competition!**",
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for FINISHED
   */
  async lobbyNotifyFinished(lobbyId: string, match: any) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.FINISHED;

    // Connect to linked Hatch service for data
    try {
      embed.fields.push(
        {
          name: ':clipboard: Logs',
          value: `[Click to view the log](${match.data.logstfUrl})`,
          inline: true,
        },
        {
          name: ':trophy: Results',
          value: `:red_circle: **${match.data.teamScore.Red}** - **${match.data.teamScore.Blue}** :blue_circle:`,
          inline: true,
        },
        {
          name: ':film_frames: STV Demo',
          value: `[Click to view the demo](${match.data.demostfUrl})`,
          inline: true,
        },
      );
    } catch (e) {
      this.logger.error(e);
    }

    // Delete the channels that were created
    // (to be discussed on what's said above)
    await this.discordService.deleteChannels(discord);

    return await message.edit({
      content: `:lock: The lobby has been locked\n\nThank you all for playing! Logs and Demos have been posted.`,
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for FAILED
   */
  async lobbyNotifyFailed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message, discord: internalLobby } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.FAILED;

    // Delete the channels that were created
    await this.discordService.deleteChannels(internalLobby);

    return await message.edit({
      content: `:x: The server failed to start! Contact the Qixalite administration team to troubleshoot this issue.\n\n:x: This lobby is now closed.`,
      embeds: [embed],
      components: [],
    });
  }

  /**
   * Does a Lobby Notification for CLOSED
   */
  async lobbyNotifyClosed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message, discord: internalLobby } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.CLOSED;

    // Delete the channels that were created
    await this.discordService.deleteChannels(internalLobby);

    // Was there an error?
    return await message.edit({
      content: `:x: The lobby has been closed!`,
      embeds: [embed],
      components: [],
    });
  }
}
