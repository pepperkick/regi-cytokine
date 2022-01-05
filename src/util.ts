import { MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import { LobbyFormat } from './objects/lobby-format.interface';

// Returns a Message object to edit an Interaction reply with the lobby's status.
export function createLobbyResponse(format: LobbyFormat, lobby: any, params?) {
  // Create a Discord message from JSON with embed info.
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
  const btnRow = new MessageActionRow({
    components: [
      new MessageButton({
        label: 'Queue up',
        customId: 'queue',
        style: 'SUCCESS',
        emoji: '✍',
      }),
      new MessageButton({
        label: 'Unqueue',
        customId: 'unqueue',
        style: 'DANGER',
        emoji: '❌',
      }),
    ],
  });

  return {
    content: params.content,
    embeds: [embed],
    components: [btnRow],
  };
}
