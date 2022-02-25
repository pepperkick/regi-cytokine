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
import { RawEmojiData } from 'discord.js/typings/rawDataTypes';
import { Lobby } from './modules/lobby/lobby.model';
import { DistributionType } from './objects/distribution.enum';
import { InteractionType } from './objects/interactions/interaction-types.enum';
import { LobbyFormat } from './objects/lobby-format.interface';
import { Player } from './objects/match-player.interface';
import { RequirementName } from './objects/requirement-names.enum';

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
   * @param distribution Optional. The Distribution method set on this lobby.
   * @returns A string with the user list from the Lobby in its correct format.
   */
  generateUserList(
    lobby,
    params?: {
      distributed?: boolean;
    },
    distribution?: DistributionType,
  ) {
    // Different format per distribution method
    switch (distribution) {
      case DistributionType.RANDOM: {
        if (params?.distributed) {
          const A = lobby.queuedPlayers.filter((user: Player) =>
              user.roles.includes(RequirementName.TEAM_A),
            ),
            B = lobby.queuedPlayers.filter((user: Player) =>
              user.roles.includes(RequirementName.TEAM_B),
            );
          return { A, B };
        } else
          return lobby.queuedPlayers
            .map((user: Player) => {
              return `<@${user.discord}>`;
            })
            .join('\n');
      }
      case DistributionType.TEAM_ROLE_BASED: {
        // Have a set of 2 columns with each class and team listed
        const fields = [];

        // Make an array of all the role requirements
        const roles = lobby.requirements;
        let count = 1;
        for (const role of roles) {
          if (role.length < 1) continue;

          // Get the players in this role
          const players = lobby.queuedPlayers.filter((player: Player) =>
            player.roles.includes(role.name as RequirementName),
          );

          // Generate the string
          const playerList = players.map(
            (player: Player) => `<@${player.discord}>`,
          );

          // Add the role to the fields
          const emoji = this.getRequirementEmoji(role.name);

          fields.push({
            name: `<:${emoji?.name}:${
              emoji?.id
            }> ${this.getRequirementDisplayName(role.name)} [${
              playerList.length
            }/${role.count}]`,
            value: playerList.length > 0 ? playerList.join('\n') : 'Empty',
            inline: true,
          });

          if (count % 2 == 0)
            fields.push({
              name: '\u200b',
              value: '\u200b',
              inline: false,
            });

          count++;
        }

        // for (const field of fields) this.logger.debug(field);

        return fields;
      }
    }
  }

  /**
   * Gets the display name of a requirement.
   * @param requirement The requirement name.
   * @returns The display name of a requirement.
   * TODO: Make this dynamic and not hard-coded lmao (can probably stay hard-coded but dunno)
   */
  getRequirementDisplayName(requirement: string): string {
    switch (requirement) {
      case 'player':
        return 'Player';
      case 'captain':
        return 'Captain';
      case 'creator':
        return 'Lobby Owner';
      case 'team_a':
        return 'Team A';
      case 'team_b':
        return 'Team B';
      case 'red-scout':
        return 'Scout (RED)';
      case 'red-soldier':
        return 'Soldier (RED)';
      case 'red-pyro':
        return 'Pyro (RED)';
      case 'red-demoman':
        return 'Demoman (RED)';
      case 'red-heavy':
        return 'Heavy (RED)';
      case 'red-engineer':
        return 'Engineer (RED)';
      case 'red-medic':
        return 'Medic (RED)';
      case 'red-sniper':
        return 'Sniper (RED)';
      case 'blu-spy':
        return 'Spy (BLU)';
      case 'blu-scout':
        return 'Scout (BLU)';
      case 'blu-soldier':
        return 'Soldier (BLU)';
      case 'blu-pyro':
        return 'Pyro (BLU)';
      case 'blu-demoman':
        return 'Demoman (BLU)';
      case 'blu-heavy':
        return 'Heavy (BLU)';
      case 'blu-engineer':
        return 'Engineer (BLU)';
      case 'blu-medic':
        return 'Medic (BLU)';
      case 'blu-sniper':
        return 'Sniper (BLU)';
      case 'blu-spy':
        return 'Spy (BLU)';
    }
  }

  /**
   * Gets the RawEmoji of a requirement.
   * @param requirement The requirement name.
   * @returns The RawEmoji object of that requirement.
   */
  getRequirementEmoji(requirement: string): RawEmojiData {
    switch (requirement as RequirementName) {
      case RequirementName.RED_SCOUT:
      case RequirementName.BLU_SCOUT:
        return { id: '946860689409056819', name: 'Scout', animated: false };
      case RequirementName.RED_SOLDIER:
      case RequirementName.BLU_SOLDIER:
        return { id: '946860689522307083', name: 'Soldier', animated: false };
      case RequirementName.RED_PYRO:
      case RequirementName.BLU_PYRO:
        return { id: '946860689694285945', name: 'Pyro', animated: false };
      case RequirementName.RED_DEMOMAN:
      case RequirementName.BLU_DEMOMAN:
        return { id: '946860690063380550', name: 'Demo', animated: false };
      case RequirementName.RED_HEAVY:
      case RequirementName.BLU_HEAVY:
        return { id: '946860689534890124', name: 'Heavy', animated: false };
      case RequirementName.RED_ENGINEER:
      case RequirementName.BLU_ENGINEER:
        return { id: '946860689488760842', name: 'Engineer', animated: false };
      case RequirementName.RED_SNIPER:
      case RequirementName.BLU_SNIPER:
        return { id: '946860690033999910', name: 'Sniper', animated: false };
      case RequirementName.RED_MEDIC:
      case RequirementName.BLU_MEDIC:
        return { id: '946860689815900250', name: 'Medic', animated: false };
      case RequirementName.RED_SPY:
      case RequirementName.BLU_SPY:
        return { id: '946860689794932757', name: 'Spy', animated: false };
    }
  }

  /**
   * Creates the correct component for a Distribution Method.
   * @param distribution The Distribution method being used.
   * @param format The LobbyFormat object used to create the lobby.
   * @param lobby The Cytokine Lobby document.
   * @returns The correct component for the Distribution Method message.
   */
  async createDistributionComponent(
    distribution: DistributionType,
    format: LobbyFormat | any,
    lobby,
  ): Promise<MessageActionRow[]> {
    switch (distribution) {
      case DistributionType.RANDOM:
        return [
          new MessageActionRow({
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
          }),
        ];
      case DistributionType.TEAM_ROLE_BASED: {
        // Format all the requirements into a menu keeping in mind missing requirements.
        const options = format.requirements
          .filter((req) => {
            // Count how many players have filled this requirement on the lobby
            const filled = lobby.queuedPlayers.filter((player) =>
              player.roles.includes(req.name),
            );

            // If it's not full, list it.
            return filled.length < req.count;
          })
          .map((opt) => {
            const label = this.getRequirementDisplayName(opt.name);

            return {
              label,
              description: `Click here to occupy the ${label} class!`,
              value: `${opt.name}|${lobby._id}`,
              emoji: this.getRequirementEmoji(opt.name),
            };
          });

        return [
          new MessageActionRow({
            components: [
              new MessageSelectMenu({
                placeholder: 'Select a class & team...',
                customId: InteractionType.TEAM_ROLE_SELECT,
                minValues: 1,
                maxValues: 1,
                options,
              }),
            ],
          }),
          new MessageActionRow({
            components: [
              new MessageButton({
                label: 'Unqueue',
                customId: InteractionType.UNQUEUE,
                style: 'DANGER',
                emoji: '❌',
              }),
            ],
          }),
        ];
      }
    }
  }

  /**
   * Reply to an interaction with the initial embed format.
   *
   * @param interaction The interaction to reply to.
   * @param format The lobby format used to create the lobby.
   * @param lobby The lobby object.
   * @param general The Lobby general channel to send the embed in.
   *
   * @return The sent message.
   */
  async lobbyInitialReply(
    interaction: ButtonInteraction | CommandInteraction,
    format: LobbyFormat,
    lobby,
    params: ReplyParameters,
    general: TextChannel,
  ): Promise<string> {
    // Make a user list with all Discord tags.
    const userList = this.generateUserList(lobby, {}, format.distribution);

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
          value: `${lobby.queuedPlayers.length}/${format.maxPlayers}\n\n${
            format.distribution === DistributionType.RANDOM ? userList : ''
          }`,
          inline: false,
        },
      ],
    });

    if (format.distribution !== DistributionType.RANDOM)
      embed.fields.push(...userList);

    // Create a Button row to queue up or leave the queue.
    const btnRows = await this.createDistributionComponent(
      format.distribution,
      format,
      lobby,
    );

    const message = {
      content: params.content,
      embeds: [embed],
      components: [...btnRows],
    };

    // Send the Lobby embed to the text channel.
    const msg = await general.send(message);

    // Tell the lobby creator where the lobby is.
    await interaction.editReply({
      content: `<@${interaction.user.id}> Your Lobby has been created successfully!\n\n:point_right: Find your lobby in <#${general.id}> to queue up and play.`,
    });
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
    const userList = this.generateUserList(
      lobby,
      {},
      lobby.distribution as DistributionType,
    );

    // Update the fields that are outdated
    const embed = message.embeds[0];

    embed.fields[3] = {
      name: '👥 Queued Players',
      value: `${lobby.queuedPlayers.length}/${lobby.maxPlayers}\n\n${
        (lobby.distribution as DistributionType) === DistributionType.RANDOM
          ? userList
          : ''
      }`,
      inline: false,
    };

    if ((lobby.distribution as DistributionType) !== DistributionType.RANDOM) {
      // Delete old fields and add the new ones
      embed.fields.splice(4, embed.fields.length - 4);
      embed.fields.push(...userList);
    }

    // Create the new Select menu with full roles omitted
    const btnRows = await this.createDistributionComponent(
      lobby.distribution as DistributionType,
      lobby, // Passing Lobby as format because both share the "requirements" property
      lobby,
    );

    return await message.edit({ embeds: [embed], components: [...btnRows] });
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
          customId: InteractionType.LOBBY_CLOSE,
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
