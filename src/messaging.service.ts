import { Logger } from '@nestjs/common';
import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  MessageSelectMenu,
  TextChannel,
} from 'discord.js';
import { InteractionType } from './objects/interactions/interaction-types.enum';
import { LobbyFormat } from './objects/lobby-format.interface';
import { Player } from './objects/match-player.interface';

interface ReplyParameters {
  content?: string;
  ephemeral?: true;
  map?: string;
  region: string;
  userId: string;
  lobbyName: string;
}

export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor() {}

  /**
   * Creates a user list from an array of players.
   * @param lobby The Lobby object from Cytokine.
   * @param params Optional parameters.
   * @returns A string with the user list from the Lobby.
   */
  generateUserList(
    lobby,
    params?: {
      classes?: boolean;
      perTeam?: boolean;
    },
  ) {
    // Return 2 different objects for each team if params.perTeam is set
    // Cooooould have a different approach but meh
    if (params) {
      if (params.perTeam) {
        const A = lobby.queuedPlayers.filter((user: Player) =>
            user.roles.includes('team_a'),
          ),
          B = lobby.queuedPlayers.filter((user: Player) =>
            user.roles.includes('team_b'),
          );

        return { A, B };
      }
    }

    // Else return the default list
    return lobby.queuedPlayers
      .map((user: Player) => {
        // TODO: Include classes if params.classes == true
        return `<@${user.discord}>`;
      })
      .join('\n');
  }

  /**
   * Reply to an interaction with the initial embed format.
   *
   * @param interaction The interaction to reply to.
   * @param format The lobby format used to create the lobby.
   * @param lobby The lobby object.
   *
   * @return The sent message.
   */
  async lobbyInitialReply(
    interaction: ButtonInteraction | CommandInteraction,
    format: LobbyFormat,
    lobby,
    params: ReplyParameters,
  ): Promise<string> {
    // Make a user list with all Discord tags.
    const userList = this.generateUserList(lobby);

    const embed = new MessageEmbed({
      title: `Lobby **${params.lobbyName}**`,
      description: `Created by <@${interaction.user.id}>`,
      color: 0x787878,
      fields: [
        {
          name: '🗒 Format',
          value: `${format.name}\n**Max. Players:** ${format.maxPlayers}\n**Distribution:** ${format.distribution}\n\n:map: **Map**: ${params.map}`,
          inline: true,
        },
        {
          name: '📍 Region',
          value: `**${params.region}**`,
          inline: true,
        },
        {
          name: '🎮 Game',
          value: `${format.game}`,
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
          customId: InteractionType.QUEUE,
          style: 'SUCCESS',
          emoji: '✍',
        }),
        new MessageButton({
          label: 'Unqueue',
          customId: InteractionType.UNQUEUE,
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
    const msg = await interaction.editReply(message);
    return msg.id;
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
    const userList = this.generateUserList(lobby);

    // Update the fields that are outdated
    const embed = message.embeds[0];

    embed.fields[3] = {
      name: '👥 Queued Players',
      value: `${lobby.queuedPlayers.length}/${lobby.maxPlayers}\n\n${userList}`,
      inline: false,
    };

    return await message.edit({ embeds: [embed] });
  }

  /**
   * Reply to an interaction.
   * @param interaction The base Interaction we're replying to.
   * @param content The reply's message content.
   * @param options Optional parameters.
   */
  async replyToInteraction(
    interaction: CommandInteraction | ButtonInteraction,
    content: string,
    options?,
  ) {
    // Create Reply object
    const reply = {
      content,
      ...options,
    };

    try {
      // Edit or reply if not replied already
      return <Message | void>(
        await (interaction.replied
          ? interaction.editReply(reply)
          : interaction.reply(reply))
      );
    } catch (e) {
      this.logger.error(e);
    }
  }

  /**
   * Creates a select menu with a list of matches in available state.
   * @param lobbies The list of active Match objects to create the select menu from.
   * @returns The MessageActionRow object with the corresponding select menu.
   */
  createLobbySelectMenu(lobbies): MessageActionRow {
    // Create an array with all the options available (aka active matches)
    const options = [];
    for (const lobby of lobbies)
      options.push({
        label: `Lobby ${lobby.name}`,
        value: lobby._id,
        description: `Created @ ${lobby.createdAt} | Status: ${lobby.status}`,
      });

    // Return the MessageActionRow
    return new MessageActionRow({
      components: [
        new MessageSelectMenu({
          customId: 'lobby-close-select',
          placeholder: 'Select a lobby to close...',
          maxValues: 1,
          minValues: 1,
          options,
        }),
      ],
    });
  }

  /**
   * Sends initial message to the general lobby channel.
   * @param channel The General TextChannel object to send the message to.
   * @param lobbyName The name of the lobby.
   */
  async sendInitialMessage(channel: TextChannel, lobbyName) {
    return await channel.send(`:wave: **Welcome to Lobby ${lobbyName}!**
      
:point_right: This channel is meant for a pre-game chat between the lobbys' players.
:x: Please do not spam or use any language that is not supported by the game.
          
:smile: Enjoy your game and happy competition!`);
  }
}
