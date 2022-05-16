import { forwardRef, Inject, Logger } from '@nestjs/common';
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
import { DiscordService } from './discord.service';
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

  constructor(
    @Inject(forwardRef(() => DiscordService))
    private readonly discord: DiscordService,
  ) {}

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
            let emoji = this.getRequirementEmoji(`red-${role.name}`, true);

            fields.push({
              name: `${emoji} ${this.getRequirementDisplayName(
                `red-${role.name}`,
              )} [${teamA.length}/${role.count}]`,
              value:
                teamA.length > 0
                  ? teamA.map((p) => `<@${p.discord}>`).join('\n')
                  : 'Empty',
              inline: true,
            });

            emoji = this.getRequirementEmoji(`blu-${role.name}`, true);

            fields.push({
              name: `${emoji} ${this.getRequirementDisplayName(
                `blu-${role.name}`,
              )} [${teamB.length}/${role.count}]`,
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
            const emoji = this.getRequirementEmoji(role.name, true);

            fields.push({
              name: `${emoji} ${this.getRequirementDisplayName(role.name)} [${
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
          const emoji = this.getRequirementEmoji(role.name, true),
            roleName = this.getRequirementDisplayName(role.name);

          fields.push({
            name: `${emoji} ${roleName} [${playerList.length}/${role.count}]`,
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
      case DistributionType.CAPTAIN_BASED: {
        // Add a field for the captains.
        const isLocked = [
          LobbyStatus.WAITING_FOR_PICKS,
          LobbyStatus.DISTRIBUTING,
          LobbyStatus.DISTRIBUTED,
        ].includes(lobby.status);

        let roles = [];

        if (isLocked) {
          // We have a picking process lobby.
          // Only list players that have been picked + captains.
          // Filter out classes that do not belong to the lobby's requirements.
          roles = [
            'captain-a',
            'captain-b',
            'scout',
            'soldier',
            'pyro',
            'demoman',
            'heavy',
            'engineer',
            'medic',
            'sniper',
            'spy',
          ];

          roles = roles.filter((r) => {
            const validRoles = lobby.requirements.map((r) => r.name);

            return validRoles.includes(r);
          });

          // Transform roles to both BLU and RED roles.
          roles = roles.flatMap((r) => {
            // Skip captain roles
            return r.startsWith('captain') ? r : [`red-${r}`, `blu-${r}`];
          });
        } else {
          // Get all possible roles
          roles = lobby.requirements;
        }

        for (const role of roles) {
          // As overfill is allowed, we only need to list the classes themselves.
          const players = lobby.queuedPlayers.filter(
            (p) =>
              p.roles.includes(isLocked ? role : role.name) &&
              (isLocked
                ? p.roles.includes('picked') ||
                  p.roles.includes('captain-a') ||
                  p.roles.includes('captain-b')
                : true),
          );

          // List all classes in the Lobby with queued players for this class.
          const playerList = players.map((p) => `<@${p.discord}>`);

          // Add the role to the fields, with its emoji and info.
          const emoji = this.getRequirementEmoji(
              isLocked ? role : role.name,
              true,
            ),
            roleName = this.getRequirementDisplayName(
              isLocked ? role : role.name,
            );

          fields.push({
            name: `${emoji} ${roleName}`,
            value: playerList.length > 0 ? playerList.join('\n') : 'Empty',
            inline: true,
          });
        }
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
      case 'can-captain':
        return 'Captain';
      case 'captain-a':
        return 'Captain (RED)';
      case 'captain-b':
        return 'Captain (BLU)';
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
      case 'red-spy':
        return 'Spy (RED)';
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
   * @param asString Optional. If true, will return the string representation of the emoji.
   * @returns The RawEmoji object of that requirement.
   */
  getRequirementEmoji(
    requirement: string | RequirementName,
    asString = false,
  ): RawEmojiData | string {
    const emoji =
      config.discord.emojis.find((e) => e.req === requirement)?.emoji ?? null;

    return asString
      ? emoji
        ? emoji?.default
          ? `:${emoji.default}:`
          : `<:${emoji.name}:${emoji.id}>`
        : '⚔️'
      : emoji;
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
    iLobby?,
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
    else {
      requirements = format.requirements;

      // Get the format name from the internal Lobby.
      if (iLobby) {
        format = config.formats[iLobby.format];
      }
    }

    // Get the options for the Lobby.
    const options = this.getRequirementList(requirements, lobby);

    switch (distribution) {
      case DistributionType.RANDOM: {
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
      case DistributionType.CAPTAIN_BASED: {
        // Get the minimum role selection for this format.
        const minValues = +format.minRoles;

        const actionRows = [];
        actionRows.push(
          new MessageActionRow({
            components: [
              new MessageSelectMenu({
                placeholder: 'Select your desired role..',
                customId: InteractionType.ROLE_SELECT_CAPTAINS,
                minValues,
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
        return req.overfill ? true : filled.length < req.count;
      })
      .map((opt) => {
        const label = this.getRequirementDisplayName(opt.name);

        return {
          label,
          description: `Click here to take the ${label} role!`,
          value: `${opt.name}|${lobby._id}`,
          emoji: this.getRequirementEmoji(opt.name, true) ?? '⚔️',
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

    const info = await this.discord.buildBaseEmbed(
      `Lobby **${params.lobbyName}**`,
      `Created by <@${interaction.user.id}>`,
      0x787878,
      false,
    );
    info.fields = [
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
    ];

    const users = await this.discord.buildBaseEmbed(
      `Queued Players List`,
      `Currently queued players for Lobby ${params.lobbyName}`,
      0x787878,
      true,
    );
    // Remove author info
    delete users.author;

    users.fields = [...userList];

    // Create a Button row to queue up or leave the queue.
    const btnRows = await this.createDistributionComponent(
      distribution,
      format,
      lobby,
    );

    const message = {
      content: params.content,
      embeds: [info, users],
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
   * @param format LobbyFormat object with data necessary to update the embeds.
   */
  async updateReply(
    lobby,
    message: Message<true> | Message<boolean>,
    format: LobbyFormat,
    content?: string,
  ): Promise<Message<boolean>> {
    // Make a user list with all Discord tags.
    const userList = this.generateUserList(
      lobby,
      {},
      lobby.distribution as DistributionType,
    );

    // Update the fields that are outdated
    const embeds = message.embeds;
    for (const embed of embeds) embed.color = color[lobby.status];

    // Update player list
    embeds[0].fields[
      embeds[0].fields.length - 1
    ].value = `${lobby.queuedPlayers.length}/${lobby.maxPlayers}`;
    embeds[1].fields = [...userList];

    // Create the new Select menu with full roles omitted
    const btnRows = await this.createDistributionComponent(
      lobby.distribution as DistributionType,
      format,
      lobby,
    );

    return await message.edit({
      content,
      embeds: [...embeds],
      components: [...btnRows],
    });
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
}
