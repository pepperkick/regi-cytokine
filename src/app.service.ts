import { Injectable } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { MessagingService } from './messaging.service';
import { LobbyService } from './modules/lobby/lobby.service';

import { StatusColors as color } from './objects/status-colors.enum';

@Injectable()
export class AppService {
  constructor(
    private lobbyService: LobbyService,
    private messagingService: MessagingService,
    private discordService: DiscordService,
  ) {}

  /**
   * Does a Lobby Notification for DISTRIBUTING
   * Locks down queueing at this instance.
   */
  async lobbyNotifyDistributing(lobbyId: string) {
    // Get DiscordInfo from the Lobby ID
    const discord = await this.lobbyService.getDiscordInfo(lobbyId);

    // Update the message.
    const message = await this.discordService.getMessage(discord.messageId);

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
    // Get DiscordInfo from the Lobby ID
    const discord = await this.lobbyService.getDiscordInfo(lobbyId);

    // Update the message.
    const message = await this.discordService.getMessage(discord.messageId);

    // Update embed color
    const embed = message.embeds[0];
    embed.color = color.DISTRIBUTED;

    // TODO: Edit the embed field to show the players' teams and classes.

    return await message.edit({
      content:
        ':white_check_mark: Players have been distributed!\n\n:hourglass: Waiting for server to start...',
      embeds: [embed],
    });
  }

  getHello(): string {
    return 'Hello World!';
  }
}
