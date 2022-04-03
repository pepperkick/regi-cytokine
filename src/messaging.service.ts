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
import { LobbyStatus } from './modules/lobby/lobby-status.enum';
import { Lobby } from './modules/lobby/lobby.model';
import { DistributionType } from './objects/distribution.enum';
import { InteractionType } from './objects/interactions/interaction-types.enum';
import { LobbyFormat } from './objects/lobby-format.interface';
import { Player } from './objects/match-player.interface';
import { RequirementName } from './objects/requirement-names.enum';
import * as color from './objects/status-colors.enum';
import * as config from '../config.json';
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
   * @returns An array of EmbedFields with updated player data.
   */
  generateUserList(
    lobby,
    params?: {
      distributed?: boolean;
    },
    distribution?: DistributionType,
  ) {
    const fields = [];

    // Different format per distribution method
    switch (distribution) {
      case DistributionType.RANDOM: {
        // If it's been distributed, do this per-team
        if (params?.distributed) {
          for (const role of lobby.requirements) {
            // Get players on this role
            const players = lobby.queuedPlayers.filter((p) =>
              p.roles.includes(role.name as RequirementName),
            );

            // Now separate them onto teams.
            const teamA = [],
              teamB = [];
            for (const player of players) {
              if (player.roles.includes(RequirementName.TEAM_A))
                teamA.push(player);
              else if (player.roles.includes(RequirementName.TEAM_B))
                teamB.push(player);
            }

            // Build the role fields for each team.
            let emoji = this.getRequirementEmoji(`red-${role.name}`);

            fields.push({
              name: `<:${emoji?.name}:${
                emoji?.id
              }> ${this.getRequirementDisplayName(`red-${role.name}`)} [${
                teamA.length
              }/${role.count}]`,
              value:
                teamA.length > 0
                  ? teamA.map((p) => `<@${p.discord}>`).join('\n')
                  : 'Empty',
              inline: true,
            });

            emoji = this.getRequirementEmoji(`blu-${role.name}`);

            fields.push({
              name: `<:${emoji?.name}:${
                emoji?.id
              }> ${this.getRequirementDisplayName(`blu-${role.name}`)} [${
                teamB.length
              }/${role.count}]`,
              value:
                teamB.length > 0
                  ? teamB.map((p) => `<@${p.discord}>`).join('\n')
                  : 'Empty',
              inline: true,
            });
          }
        } else {
          // Make an array of all the role requirements
          const roles = lobby.requirements;
          for (const role of roles) {
            if (role.count < 1) continue;

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
          }
        }

        break;

        /* wonder who wrote this code LMAO (probably a dumb person)
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
            .join('\n');*/
      }
      case DistributionType.TEAM_ROLE_BASED: {
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

        break;
      }
    }

    return fields;
  }

  /**
   * Sends a message to the Lobby's general channel for players to confirm their non-AFK status.
   * @param lobby The Cytokine Lobby document we're doing the AFK check for.
   * @param channel The TextChannel we're sending the message to.
   * @noreturn
   */
  async sendAFKCheck(lobby, channel: TextChannel) {
    // Get the Lobby's player information.
    const players = lobby.queuedPlayers
      .map((player) => `:hourglass: <@${player.discord}> (${player.name})`)
      .join('\n');

    return channel.send({
      content: `:hourglass: **AFK Check** (:alarm_clock: ${(
        config.lobbies.afkCheckTimeout / 60
      ).toFixed(
        2,
      )} minute(s))\n\nPlease confirm that you are not AFK by clicking on the button below.\n${players}`,
      components: [
        new MessageActionRow({
          components: [
            new MessageButton({
              label: 'I am not AFK',
              style: 'SUCCESS',
              customId: 'afk-check',
            }),
          ],
        }),
      ],
    });
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
      case 'captain-a':
        return 'Captain (Team A)';
      case 'captain-b':
        return 'Captain (Team B)';
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
      case 'scout':
        return 'Scout';
      case 'soldier':
        return 'Soldier';
      case 'pyro':
        return 'Pyro';
      case 'demoman':
        return 'Demoman';
      case 'heavy':
        return 'Heavy';
      case 'engineer':
        return 'Engineer';
      case 'medic':
        return 'Medic';
      case 'sniper':
        return 'Sniper';
      case 'spy':
        return 'Spy';
      default:
        return 'Unknown Role';
    }
  }

  /**
   * Gets the RawEmoji of a requirement.
   * @param requirement The requirement name.
   * @returns The RawEmoji object of that requirement.
   * @deprecated This will be switched with a highly configurable method on Regi-Cytokine's config file. For now this suffices.
   */
  getRequirementEmoji(requirement: string): RawEmojiData {
    switch (requirement as RequirementName) {
      case RequirementName.RED_SCOUT:
        return { id: '953382922621157476', name: 'REDScout' };
      case RequirementName.BLU_SCOUT:
        return { id: '953382893856641075', name: 'BLUScout' };
      case RequirementName.SCOUT:
        return { id: '953382870179778600', name: 'Scout' };
      case RequirementName.RED_SOLDIER:
        return { id: '953382922541482094', name: 'REDSoldier' };
      case RequirementName.BLU_SOLDIER:
        return { id: '953382894225739816', name: 'BLUSoldier' };
      case RequirementName.SOLDIER:
        return { id: '953382870263672923', name: 'Soldier' };
      case RequirementName.RED_PYRO:
        return { id: '953382922541482064', name: 'REDPyro' };
      case RequirementName.BLU_PYRO:
        return { id: '953382894095728730', name: 'BLUPyro' };
      case RequirementName.PYRO:
        return { id: '953382870137843723', name: 'Pyro' };
      case RequirementName.RED_DEMOMAN:
        return { id: '953382922277224498', name: 'REDDemo' };
      case RequirementName.BLU_DEMOMAN:
        return { id: '953382893898588201', name: 'BLUDemo' };
      case RequirementName.DEMOMAN:
        return { id: '953382870070747256', name: 'Demo' };
      case RequirementName.RED_HEAVY:
        return { id: '953382922222723132', name: 'REDHeavy' };
      case RequirementName.BLU_HEAVY:
        return { id: '953382894150250497', name: 'BLUHeavy' };
      case RequirementName.HEAVY:
        return { id: '953382870293053470', name: 'Heavy' };
      case RequirementName.RED_ENGINEER:
        return { id: '953382921878782004', name: 'REDEngineer' };
      case RequirementName.BLU_ENGINEER:
        return { id: '953382893688877158', name: 'BLUEngineer' };
      case RequirementName.ENGINEER:
        return { id: '953382870121054259', name: 'Engineer' };
      case RequirementName.RED_SNIPER:
        return { id: '953382922637967470', name: 'REDSniper' };
      case RequirementName.BLU_SNIPER:
        return { id: '953382894192193546', name: 'BLUSniper' };
      case RequirementName.SNIPER:
        return { id: '953382870418870332', name: 'Sniper' };
      case RequirementName.RED_MEDIC:
        return { id: '953382922457591828', name: 'REDMedic' };
      case RequirementName.BLU_MEDIC:
        return { id: '953382894192181350', name: 'BLUMedic' };
      case RequirementName.MEDIC:
        return { id: '953382870272073748', name: 'Medic' };
      case RequirementName.RED_SPY:
        return { id: '953382922453393460', name: 'REDSpy' };
      case RequirementName.BLU_SPY:
        return { id: '953382894175387678', name: 'BLUSpy' };
      case RequirementName.SPY:
        return { id: '953382872805421107', name: 'Spy' };
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
    // If the Lobby's status is not in a component generation state, don't return anything.
    if (lobby.status != LobbyStatus.WAITING_FOR_REQUIRED_PLAYERS) return [];

    // Format all the requirements into a menu keeping in mind missing requirements.
    let requirements;
    if (format?.distribution instanceof Array)
      requirements = format?.distribution.find(
        (d) => d.type === distribution,
      ).requirements;
    // If it failed, it's because a Lobby object was passed in instead of a LobbyFormat object.
    else requirements = format.requirements;

    switch (distribution) {
      case DistributionType.RANDOM: {
        const options = this.getRequirementList(requirements, lobby);

        // Add the SelectMenu only if there is at least one option for a player to choose.
        const rows = [];
        if (options.length > 0) {
          rows.push(
            new MessageActionRow({
              components: [
                new MessageSelectMenu({
                  placeholder: 'Select your class...',
                  customId: InteractionType.ROLE_SELECT,
                  minValues: 1,
                  maxValues: 1,
                  options,
                }),
              ],
            }),
          );
        }

        rows.push(
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
        );

        return rows;
      }
      case DistributionType.TEAM_ROLE_BASED: {
        const options = this.getRequirementList(requirements, lobby);

        // If there are no options, do not return a MessageSelectMenu
        const actionRows = [];
        if (options.length > 0)
          actionRows.push(
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
          );

        actionRows.push(
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
        );

        return actionRows;
      }
    }
  }

  /**
   * Generates a list of options for a SelectMenu with available roles in the Lobby for users to select from.
   * @param requirements The list of requirements in the Lobby.
   * @param lobby The Cytokine Lobby document.
   * @returns Array of options for a SelectMenu Discord component.
   */
  getRequirementList(requirements, lobby: any) {
    return requirements
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
    distributionName?: string,
  ): Promise<string> {
    const distribution = format.distribution.find(
      (dist) => dist.type == lobby.distribution,
    ).type as DistributionType;

    // Make a user list with all Discord tags.
    const userList = this.generateUserList(lobby, {}, distribution);

    const embed = new MessageEmbed({
      title: `Lobby **${params.lobbyName}**`,
      description: `Created by <@${interaction.user.id}>`,
      color: 0x787878,
      fields: [
        {
          name: 'Format & Info',
          value: `🗒 **Format**: ${format.name}\n:bust_in_silhouette: **Max. Players**: ${format.maxPlayers}\n:cyclone: **Distribution**: ${distributionName}\n:map: **Map**: [${params.map}](http://fastdl.tf.qixalite.com/${params.map}.bsp)`,
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
          value: `${lobby.queuedPlayers.length}/${format.maxPlayers}`,
          inline: false,
        },
        ...userList,
      ],
    });

    // Create a Button row to queue up or leave the queue.
    const btnRows = await this.createDistributionComponent(
      distribution,
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
    embed.color = color[lobby.status];

    embed.fields[3] = {
      name: '👥 Queued Players',
      value: `${lobby.queuedPlayers.length}/${lobby.maxPlayers}`,
      inline: false,
    };
    embed.fields.splice(4, embed.fields.length - 4);
    embed.fields.push(...userList);

    // Create the new Select menu with full roles omitted
    const btnRows = await this.createDistributionComponent(
      lobby.distribution as DistributionType,
      lobby,
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

        const connect = `connect ${sv.sdrEnable ? sv.sdrIp : ip}:${
          sv.sdrEnable ? sv.sdrPort : port
        };${sv.password.length > 0 ? ` password ${sv.password}` : ''}`;

        embed.description += `\nServer Information
Hostname:                    ${sv.servername}
Provider:                    ${provider}
Status:                      ${svStatus}
Image:                       ${image}
Started:                     ${new Date(svCreatedAt).toUTCString()}

Connection String:           ${connect}; (Original IP: ${ip}:${port})
Connection String with RCON: ${connect}; ${
          sv.sdrEnable ? `rcon_address ""; rcon_address ${ip}:${port}` : ''
        }; rcon_password ${sv.rconPassword};
RCON Password:               ${sv.rconPassword}

Hatch URI:                   http://${ip}${sv.hatchAddress}/status?password=${
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
