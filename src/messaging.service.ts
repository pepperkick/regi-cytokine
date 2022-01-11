import { Logger } from '@nestjs/common';
import { APIMessage } from 'discord-api-types';
import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} from 'discord.js';
import { ButtonType } from './objects/buttons/button-types.enum';
import { LobbyFormat } from './objects/lobby-format.interface';
import { Player } from './objects/match-player.interface';

interface ReplyParameters {
  content?: string;
  ephemeral?: true;
  region: string;
  userId: string;
}

export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor() {}

  /**
   * Reply to an interaction with the correct embed format.
   *
   * @param interaction The interaction to reply to.
   * @param format The lobby format used to create the lobby.
   * @param lobby The lobby object.
   *
   * @return The sent message.
   */
  async lobbyReply(
    interaction: ButtonInteraction | CommandInteraction,
    format: LobbyFormat,
    lobby,
    params: ReplyParameters,
  ): Promise<Message<true> | APIMessage | Message<boolean> | void> {
    // Make a user list with all Discord tags.
    const userList = lobby.queuedPlayers
      .map((user: Player) => `<@${user.discord}>`)
      .join('\n');

    const embed = new MessageEmbed({
      title: `Lobby ${lobby._id}`,
      description: '',
      color: 0x3a9d3c,
      fields: [
        {
          name: '🗒 Format',
          value: `${format.name}\n**Max. Players:** ${format.maxPlayers}\n**Distribution:** ${format.distribution}`,
          inline: true,
        },
        {
          name: '📍 Region',
          value: `**${params.region}**`,
          inline: true,
        },
        {
          name: '🎮 Game',
          value: `${lobby.game}`,
          inline: true,
        },
        {
          name: '👥 Queued Players',
          value: `${lobby.queuedPlayers.length}/${format.maxPlayers}\n\n${userList}`,
          inline: false,
        },
        {
          name: '\u200B',
          value: 'Click on the button below to queue up!',
        },
      ],
    });

    // Create a Button row to queue up or leave the queue.
    //
    // TODO: Add support for other Lobby Distribution Methods
    const btnRow = new MessageActionRow({
      components: [
        new MessageButton({
          label: 'Queue up',
          customId: ButtonType.QUEUE,
          style: 'SUCCESS',
          emoji: '✍',
        }),
        new MessageButton({
          label: 'Unqueue',
          customId: ButtonType.UNQUEUE,
          style: 'DANGER',
          emoji: '❌',
        }),
      ],
    });

    const message = {
      content: params.content,
      embeds: [embed],
      components: [btnRow],
    };

    // Reply to the interaction with the embed and button row.
    // yes i left this in on purpose :P
    if (interaction instanceof CommandInteraction)
      return await interaction.editReply(message);
    else return await interaction.update(message);
  }

  /**
   * Update existing Slash command reply to renew the player counts and user list.
   *
   * @param lobby The updated lobby information
   * @param message The original message to update
   */
  async updateReply(
    lobby,
    message: Message<true> | Message<boolean>,
  ): Promise<Message<boolean>> {
    // Make a user list with all Discord tags.
    const userList = lobby.queuedPlayers
      .map((user: Player) => `<@${user.discord}>`)
      .join('\n');

    // Update the fields that are outdated
    const embed = message.embeds[0];

    embed.fields[3] = {
      name: '👥 Queued Players',
      value: `${lobby.queuedPlayers.length}/${lobby.maxPlayers}\n\n${userList}`,
      inline: false,
    };

    return await message.edit({ embeds: [embed] });
  }
}
