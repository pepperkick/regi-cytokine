import { Injectable } from '@nestjs/common';
import { Message } from 'discord.js';
import { DiscordService } from './discord.service';
import { MessagingService } from './messaging.service';
import { LobbyService } from './modules/lobby/lobby.service';

import { StatusColors as color } from './objects/status-colors.enum';

@Injectable()
export class AppService {
  constructor(
    private lobbyService: LobbyService,
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
  async lobbyNotifyDistributed(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTED;

    // TODO: Edit the embed field to show the players' teams and classes.

    return await message.edit({
      content:
        ':white_check_mark: Players have been distributed!\n\n:hourglass: Creating team specific channels...',
      embeds: [embed],
    });
  }

  /**
   * Does a Lobby Notification for LOBBY_READY
   */
  async lobbyNotifyLobbyReady(lobbyId: string) {
    // Get the Message object for this LobbyID
    const { message, discord } = await this.getMessage(lobbyId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.LOBBY_READY;

    // Create the team specific channels.
    const { teamA, teamB } = await this.discordService.createTeamChannels(
      discord.channels.categoryId,
    );

    // Update the last field message, mentioning team specific channels.
    embed.fields.push(
      {
        name: ':red_circle: Team A Channels',
        value: `<#${teamA.text.id}>\n<#${teamA.voice.id}>`,
        inline: true,
      },
      {
        name: ':blue_circle: Team B Channels',
        value: `<#${teamB.text.id}>\n<#${teamB.voice.id}>`,
        inline: true,
      },
    );

    return await message.edit({
      content:
        ':white_check_mark: Lobby is ready!\n\n:point_right: Join your respective team channels below.\n:hourglass: Waiting for server to start...',
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
        ":white_check_mark: It's game time! Server details have been posted below.",
    });
  }
}
