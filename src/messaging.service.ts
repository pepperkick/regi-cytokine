import { Logger } from '@nestjs/common';
import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  MessageSelectMenu,
  SelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { Lobby } from './modules/lobby/lobby.model';
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
          name: 'Format & Info',
          value: `🗒 **Format**: ${format.name}\n:bust_in_silhouette: **Max. Players**: ${format.maxPlayers}\n:cyclone: **Distribution**: ${format.distribution}\n:map: **Map**: ${params.map}`,
          inline: true,
        },
        {
          name: 'Region',
          value: `📍 **${params.region}**`,
          inline: true,
        },
        {
          name: 'Game',
          value: `🎮 ${format.game}`,
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
    interaction: CommandInteraction | ButtonInteraction | SelectMenuInteraction,
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
        await (interaction.replied || interaction.deferred
          ? interaction.editReply(reply)
          : interaction.reply(reply))
      );
    } catch (e) {
      this.logger.error(e);
    }
  }

  /**
   * Builds the status of a Lobby on an Embed.
   * @param all If true, it lists all active lobbies. Only needs the 'lobbies' parameter to be sent.
   * @param lobbies An array of Cytokine Lobby documents to list. Not needed if parsing a specific lobby.
   * @param lobby The Cytokine Lobby document.
   * @param iLobby The Internal Regi-Cytokine Lobby document.
   * @param match The Cytokine Match document.
   * @param server The Lighthouse Server document.
   * @returns The Message with the status of the Lobby built.
   */
  async buildLobbyStatusEmbed(
    all: boolean,
    lobbies?,
    lobby?,
    iLobby?: Lobby,
    match?,
    server?,
  ): Promise<object> {
    const message = {
      embeds: [],
    };

    // Get all lobbies
    if (all) {
      // Loop through all lobbies and build a list of them for the embed.
      const lobbyList = lobbies
        .map((lobby) => `${lobby._id} (Created by ${lobby.createdBy})`)
        .join('\n');

      // Construct the embed
      message.embeds.push(
        new MessageEmbed({
          title: `Status for all Lobbies`,
          description: `\`\`\`${lobbyList}\`\`\``,
          color: 0x408ecf,
          fields: [
            {
              name: 'Active',
              value: `${lobbies.length ?? 'N/A'}`,
            },
          ],
        }),
      );
    } else {
      // Specific Lobby
      // Destructure the Lobby document (Cytokine)
      const {
          _id: lobbyId,
          status: lobbyStatus,
          distribution,
          createdAt,
          createdBy,
          match: matchId,
        } = lobby,
        // Destructure the Internal Lobby document (Regi-Cytokine)
        { name, channels, messageId } = iLobby,
        // Destructure the Match document.
        { game, region, map, status: matchStatus, preferences } = match;

      // Build a channel string
      const channelList = `1. Category: ${
        channels.categoryId ?? 'Not set'
      }\n2. General:\n- ${channels.general.textChannelId ?? 'Not set'}\n- ${
        channels.general.voiceChannelId ?? 'Not set'
      }\n3. Team A:\n- ${channels.teamA?.textChannelId ?? 'Not set'}\n- ${
        channels.teamA?.voiceChannelId ?? 'Not set'
      }\n4. Team B:\n- ${channels.teamB?.textChannelId ?? 'Not set'}\n- ${
        channels.teamB?.voiceChannelId ?? 'Not set'
      }`;

      // Create the embed
      const embed = new MessageEmbed({
        title: `Status for Lobby ${lobbyId} (${name})`,
        color: 0x408ecf,
        description: `\`\`\`
Lobby Information
ID:              ${lobbyId}
Discord ID:      ${createdBy}
Created:         ${new Date(createdAt).toUTCString()}
Expires:         ${lobby.data.expiryTime}
Status:          ${lobbyStatus}
Distribution:    ${distribution}
Message ID:      ${messageId}
Channels Linked:
${channelList}

Match Information
ID:           ${matchId}
Region:       ${region}
Game:         ${game}
Map:          ${map}
Status:       ${matchStatus}
Config File:  ${preferences.gameConfig}
Use SDR?:     ${preferences.valveSdr}
`,
      });

      // If there is a valid server, add it to the embed
      // Destructure the Server document.
      if (server) {
        const {
          provider,
          data: sv,
          status: svStatus,
          image,
          ip,
          port,
          createdAt: svCreatedAt,
        } = server;

        embed.description += `\nServer Information
Hostname:          ${sv.servername}
Provider:          ${provider}
Status:            ${svStatus}
Image:             ${image}
Started:           ${new Date(svCreatedAt).toUTCString()}

Connection String: connect ${sv.sdrEnable ? sv.sdrIp : ip}:${
          sv.sdrEnable ? sv.sdrPort : port
        };${sv.password.length > 0 ? ` password ${sv.password}` : ''}
RCON Password:     ${sv.rconPassword}

Hatch URI:         http://${ip}${sv.hatchAddress}/status?password=${
          sv.hatchPassword
        }`;
      }

      // End the code block
      embed.description += '```';

      // Now build the status message and send it
      message.embeds.push(embed);
    }

    // Return the built Message template object.
    return message;
  }

  /**
   * Creates a select menu with a list of lobbies in available state.
   * @param lobbies The list of active Lobby objects to create the select menu from.
   * @returns The MessageActionRow object with the corresponding select menu.
   */
  createLobbySelectMenu(lobbies): MessageActionRow {
    // Create an array with all the options available (aka active lobbies)
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
