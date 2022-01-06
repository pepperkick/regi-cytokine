import { Injectable, Logger } from '@nestjs/common';
import { APIMessage } from 'discord-api-types';
import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
} from 'discord.js';
import { ButtonType } from './objects/buttons/button-types.enum';
import { LobbyFormat } from './objects/lobby-format.interface';

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
    interaction: CommandInteraction,
    format: LobbyFormat,
    lobby,
    params: ReplyParameters,
  ): Promise<Message<true> | APIMessage | Message<boolean>> {
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
          value: `${lobby.players.length}/${format.maxPlayers}\n\n<@${params.userId}>`,
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
    const buttonInfo = {
      lobbyId: lobby._id,
    };

    const btnRow = new MessageActionRow({
      components: [
        new MessageButton({
          label: 'Queue up',
          customId: JSON.stringify({
            ...buttonInfo,
            type: ButtonType.QUEUE,
          }),
          style: 'SUCCESS',
          emoji: '✍',
        }),
        new MessageButton({
          label: 'Unqueue',
          customId: JSON.stringify({
            ...buttonInfo,
            type: ButtonType.UNQUEUE,
          }),
          style: 'DANGER',
          emoji: '❌',
        }),
      ],
    });

    // Reply to the interaction with the embed and button row.
    return await interaction.editReply({
      content: params.content,
      embeds: [embed],
      components: [btnRow],
    });
  }
}
