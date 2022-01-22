import { Injectable } from '@nestjs/common';
import { Message, TextChannel } from 'discord.js';
import { DiscordService } from './discord.service';
import { MessagingService } from './messaging.service';
import { LobbyService } from './modules/lobby/lobby.service';
import { Player } from './objects/match-player.interface';

import { StatusColors as color } from './objects/status-colors.enum';

@Injectable()
export class AppService {
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
    embed.fields[embed.fields.length - 1].value =
      ':x: You cannot queue up at this point.';

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
        discord.channels.categoryId,
      );

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
  async lobbyNotifyLive(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LIVE;

    return await message.edit({
      content:
        ":white_check_mark: Lobby is ready!\n\n:point_right: Join your respective team channels below.\n:white_check_mark: It's game time! Server details have been posted below.",
    });
  }

  /**
   * Does a Lobby Notification for FINISHED
   */
  async lobbyNotifyFinished(lobbyId: string) {
    // TODO: Add logs and demos links to send into the general channel / in the embed.
    // This would probably require another state from Lighthouse such as "UPLOADS_FINISHED" or something different as its not Qix dependent but 3rd party.

    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.FINISHED;

    // Delete the channels that were created
    // (to be discussed on what's said above)
    this.discordService.deleteChannels(
      await this.lobbyService.getInternalLobbyById(lobbyId),
    );

    return await message.edit({
      content: `:lock: The lobby has been locked\n\nThank you all for playing! Logs and Demos will be posted in <#${discord.channels.general.textChannelId}>.`,
    });
  }

  /**
   * Does a Lobby Notification for FAILED
   */
  async lobbyNotifyFailed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.FAILED;

    // Delete the channels that were created
    this.discordService.deleteChannels(
      await this.lobbyService.getInternalLobbyById(lobbyId),
    );

    return await message.edit({
      content:
        ':x: The server failed to start! Contact the Qixalite administration team to troubleshoot this issue.\n\n:x: This lobby is now closed.',
      embeds: [embed],
      components: [],
    });
  }
}
