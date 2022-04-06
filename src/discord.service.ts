import { Logger } from '@nestjs/common';
import {
  CategoryChannel,
  CategoryCreateChannelOptions,
  Collection,
  GuildChannel,
  GuildMember,
  Intents,
  Interaction,
  Message,
  MessageEmbed,
  NewsChannel,
  OverwriteResolvable,
  Role,
  StageChannel,
  StoreChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { Client } from 'discordx';

import * as config from '../config.json';
import { Lobby } from './modules/lobby/lobby.model';
import { Player } from './objects/match-player.interface';
import { RequirementName } from './objects/requirement-names.enum';

export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private bot: Client;

  // On instantiation, execute logic to run the bot.
  constructor() {
    this.run();
  }

  /**
   * Get the Bot Client
   */
  public getClient(): Client {
    return this.bot;
  }

  /**
   * Gets the Category for a Lobby being passed the Lobby.
   * @param lobby Internal Lobby document.
   * @returns The CategoryChannel object corresponding to that Lobby.
   */
  async getCategory(lobby: Lobby): Promise<CategoryChannel> {
    return (await this.getChannel(
      lobby.channels.categoryId,
    )) as CategoryChannel;
  }

  /**
   * Gets a channel being passed its ID.
   * @param channel The Channel to find.
   * @returns The channel object if found.
   */
  async getChannel(
    channel: string,
  ): Promise<
    | TextChannel
    | VoiceChannel
    | CategoryChannel
    | NewsChannel
    | StoreChannel
    | StageChannel
    | GuildChannel
  > {
    // Get the guild
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Find the channel
    const ch = await guild.channels.fetch(channel);

    return ch ? ch : null;
  }

  /**
   * Gets array of Discord GuildMember being passed their IDs.
   * @param ids Array of Discord User IDs.
   * @returns Null if not found, GuildMember object of the user if found.
   */
  async getMembers(
    ids: string[],
  ): Promise<Collection<string, GuildMember> | null> {
    // Get the Guild
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Find the users
    const members = await guild.members.fetch({
      user: ids,
      force: true,
    });

    // Return the users
    return members ? members : null;
  }

  /**
   * Gets a Discord GuildMember being passed their ID.
   * @param id The Discord ID of this user.
   * @returns Null if not found, GuildMember object of the user if found.
   */
  async getMember(id: string): Promise<GuildMember | null> {
    // Get the Guild
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Find the user
    const member = await guild.members.fetch({
      user: id,
      force: true,
      limit: 1,
    });

    // Return the user
    return member ? member : null;
  }

  /**
   * Gets a Discord Role being passed their ID.
   * @param id The Discord ID of the role.
   * @returns Null if not found, Role object of the role if found.
   */
  async getRole(id: string): Promise<Role | null> {
    // Get the Guild
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Find the role
    const role = await guild.roles.fetch(id, {
      force: true,
      cache: false,
    });

    // Return the user
    return role ? role : null;
  }

  /**
   * Gets a Discord everyone Role for a guild.
   * @returns Null if not found, Role object of the role if found.
   */
  async getEveryoneRole(): Promise<Role | null> {
    // Get the Guild
    const guild = await this.bot.guilds.fetch(config.discord.guild);
    return guild.roles.everyone;
  }

  /**
   * Gets a Discord Message object from the message ID.
   */
  async getMessage(
    messageId: string,
    channelId: string,
  ): Promise<Message<true> | Message<boolean>> {
    // Get the Guild first
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Search for the channel inside the guild
    const channel = await guild.channels.fetch(channelId);

    // Get the message from the channel
    if (channel instanceof TextChannel)
      return await channel.messages.fetch(messageId);
  }

  /**
   * Finds a role for a specific region &/or format.
   * @param region
   * @param format The Format name, if provided will return region-format specific role.
   * @returns The Role instance.
   */
  async findRegionFormatRole(region: string, format?: string): Promise<Role> {
    // Find the region object
    const r = config.regions[region];
    if (!r) {
      this.logger.error(
        `Tried to find region role for invalid region '${region}'`,
      );
      return await this.getEveryoneRole();
    }

    // If no format parameter was provided just return the region role.
    const fRole = r?.roles?.format.find((f) => f?.name === format)?.role;

    const roleId = !fRole ? r?.roles?.region : fRole;

    // If no region role was found, return the everyone role.
    return typeof roleId !== 'string'
      ? await this.getEveryoneRole()
      : await this.getRole(roleId);
  }

  /**
   * Generates a permissions array only with queued players in a Lobby.
   * @param players Array of Queued Players in a Lobby.
   * @returns Array of permissions to set for a channel.
   */
  async compileQueuePermissions(
    players: any[],
  ): Promise<OverwriteResolvable[]> {
    // Declare permissions array
    const perms: OverwriteResolvable[] = [];

    // Push permissions to the array
    for (const player of players)
      perms.push({
        id: await this.getMember(player.discord),
        allow: ['VIEW_CHANNEL', 'CONNECT'],
        deny: ['SEND_MESSAGES', 'SPEAK'],
      });

    // Deny access to the rest of users
    perms.push({
      id: await this.getEveryoneRole(),
      deny: ['VIEW_CHANNEL', 'CONNECT'],
    });

    return perms;
  }

  /**
   * Creates (or updates) the Information Channel for a Lobby.
   * @param lobby The Internal Lobby document.
   * @param players The Lobby Queued Players array.
   * @returns The Information TextChannel instance.
   */
  async createInfoChannel(lobby: Lobby, players: any[]): Promise<TextChannel> {
    // Get permissions for the Info channel.
    const permissionOverwrites = await this.compileQueuePermissions(players);

    // If the channel already exists, update perms and return it.
    if (lobby.channels.general.infoChannelId?.length) {
      const info = (await this.getChannel(
        lobby.channels.general.infoChannelId,
      )) as TextChannel;

      await info.edit(
        {
          permissionOverwrites,
        },
        'Updated Info Channel Permissions',
      );

      return info;
    }

    // If not, create it!
    const cat = await this.getCategory(lobby);

    const info = await cat.createChannel(`${lobby.name}-info`, {
      type: 'GUILD_TEXT',
      reason: `This is an automatically generated text channel for Cytokine lobbies.`,
      topic: `**This is a temporary channel for lobby information.** This will be deleted after the lobby has been completed.`,
      permissionOverwrites,
    });

    // Update internal lobby
    lobby.channels.general.infoChannelId = info.id;
    lobby.markModified('channels');
    await lobby.save();

    return info;
  }

  /**
   * Builds a base Qixalite styled MessageEmbed.
   * @param title A custom title to set on the embed.
   * @param description A custom description to set on the embed.
   * @returns A Qix-styled MessageEmbed instance.
   */
  async buildBaseEmbed(
    title?: string,
    description?: string,
  ): Promise<MessageEmbed> {
    return new MessageEmbed({
      title: title ? title : 'Qixalite',
      description: description ? description : '',
      color: '#06D6A0',
      footer: {
        text: `Kindest Regards, Qixalite • ${new Date().toLocaleDateString(
          'en-US',
        )}`,
      },
      author: {
        name: 'Qixalite',
        iconURL:
          'https://media.discordapp.net/attachments/743005170996215839/743077007889268736/QixaliteLogoDiscord3.png',
      },
      fields: [],
    });
  }

  /**
   * Creates general Text & Voice channel for a lobby.
   */
  async createLobbyChannels(
    name: string,
    team?,
    rtcRegion?: string,
    permissions?: OverwriteResolvable[],
  ): Promise<{
    text: TextChannel;
    voice: VoiceChannel;
  }> {
    // Get the Guild we're working on
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Create a Text & Voice Channel
    try {
      // Get the category set in the Config file. If none is set, create one.
      const category: CategoryChannel =
        team?.category?.length || team?.enabled
          ? ((await guild.channels.fetch(team.category)) as CategoryChannel)
          : await guild.channels.create(`Lobby ${name}`, {
              type: 'GUILD_CATEGORY',
              reason:
                'This is an automatically generated category for Cytokine lobbies.',
              permissionOverwrites: permissions,
            });

      // Now that we have a category, create the General Text & Voice Channels.
      // If permissions are empty, have the channels inherit the Category's permissions.
      // Otherwise, set the permissions to the ones passed in (could be due to Team Channel creation or other)
      const gOptions: CategoryCreateChannelOptions = {
          type: 'GUILD_TEXT',
          reason:
            'This is an automatically generated text channel for Cytokine lobbies.',
          topic:
            '**This is a temporary channel for lobby chat.** This will be deleted after the lobby has been completed.',
        },
        gVOptions: CategoryCreateChannelOptions = {
          type: 'GUILD_VOICE',
          reason:
            'This is an automatically generated voice channel for Cytokine lobbies.',
          topic:
            '**This is a temporary channel for lobby voice.** This will be deleted after the lobby has been completed.',
          rtcRegion,
        };

      // If team channels aren't being created, have the General Text Channel not grant permissions to send messages or anything.
      if (!team.enabled) {
        const generalPerms = {
          id: await this.getEveryoneRole(),
          deny: [
            'SEND_MESSAGES',
            'ADD_REACTIONS',
            'CREATE_PUBLIC_THREADS',
            'CREATE_PRIVATE_THREADS',
          ],
        };

        // If there are permissions present, it means an override (be it role & format or accessList) is present.
        // Deny channel viewing for everyone so only they can see it.
        if (permissions.length > 0) generalPerms.deny.push('VIEW_CHANNEL');

        gOptions['permissionOverwrites'] = [
          ...permissions.filter(
            async (p) => p?.id != (await this.getEveryoneRole()),
          ),
          generalPerms as OverwriteResolvable,
        ];
      }
      // If we're creating team channels, let's set the permissions on them for each player.
      else {
        gOptions['permissionOverwrites'] = permissions;
        gVOptions['permissionOverwrites'] = permissions;
      }

      const gTextChannel = await category.createChannel(
          `${team.enabled ? team.text : config.lobbies.lobbyTextPrefix}${
            team.enabled ? '' : name
          }`,
          gOptions,
        ),
        gVoiceChannel = await category.createChannel(
          `${team.enabled ? team.voice : config.lobbies.lobbyVoicePrefix}${
            team.enabled ? '' : name
          }`,
          gVOptions,
        );

      return {
        text: gTextChannel as TextChannel,
        voice: gVoiceChannel as VoiceChannel,
      };
    } catch (e) {
      // Probably missing permissions when creating channels.
      console.error(e);
      return { text: undefined, voice: undefined };
    }
  }

  /**
   * Creates team specific channels, both Text and Voice.
   * This should be done after LOBBY_READY status is sent.
   */
  async createTeamChannels(
    name: string,
    categoryId: string,
    region?: string,
    players?: Player[],
  ): Promise<{
    teamA: {
      text: TextChannel;
      voice: VoiceChannel;
    };
    teamB: {
      text: TextChannel;
      voice: VoiceChannel;
    };
  }> {
    const teamAPerms: OverwriteResolvable[] = [];
    const teamBPerms: OverwriteResolvable[] = [];
    for (const player of players) {
      if (
        player.roles.includes(<RequirementName>'team_a') ||
        player.roles.filter((r) => r.includes('red')).length > 0
      ) {
        teamAPerms.push({
          id: await this.getMember(player.discord),
          allow: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK'],
        });
      } else if (
        player.roles.includes(<RequirementName>'team_b') ||
        player.roles.filter((r) => r.includes('blu')).length > 0
      ) {
        teamBPerms.push({
          id: await this.getMember(player.discord),
          allow: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK'],
        });
      }
    }

    teamAPerms.push({
      id: await this.getEveryoneRole(),
      deny: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK'],
    });
    teamBPerms.push({
      id: await this.getEveryoneRole(),
      deny: ['VIEW_CHANNEL', 'CONNECT', 'SPEAK'],
    });

    // Create one for Team A
    const teamA = await this.createLobbyChannels(
        name,
        {
          voice: config.lobbies.teams.A.voice,
          text: config.lobbies.teams.A.text,
          category: categoryId,
          enabled: true,
        },
        region,
        teamAPerms,
      ),
      // Create one for Team B
      teamB = await this.createLobbyChannels(
        name,
        {
          voice: config.lobbies.teams.B.voice,
          text: config.lobbies.teams.B.text,
          category: categoryId,
          enabled: true,
        },
        region,
        teamBPerms,
      );

    return { teamA, teamB };
  }

  /**
   * Deletes all the channels created for a lobby.
   * @param lobby The internal Lobby document.
   */
  async deleteChannels(lobby) {
    // Delete the channels
    const channels = [
      lobby.channels.categoryId,
      lobby.channels.general.textChannelId,
      lobby.channels.general?.infoChannelId,
      lobby.channels.teamA?.textChannelId,
      lobby.channels.teamB?.textChannelId,
      lobby.channels.general.voiceChannelId,
      lobby.channels.teamA?.voiceChannelId,
      lobby.channels.teamB?.voiceChannelId,
    ];

    for (const id of channels) {
      if (id !== undefined) {
        try {
          // Get the channel with that ID and delete it
          try {
            const channel = await this.bot.channels.fetch(id);

            if (channel) await channel.delete();
          } catch (e) {
            this.logger.warn(
              `Could not find channel with ID ${id}. Skipping...`,
            );
            continue;
          }
        } catch (e) {
          this.logger.error(
            `Tried to delete channel ${id} from Lobby ${lobby.id}: ${e}.`,
          );
          return e;
        }
      }
    }
  }

  /**
   * Sends the server details to the general lobby channel.
   */
  async sendServerDetails(channel: TextChannel, server) {
    // Build the details' strings
    const connect = `connect ${
      server.data.sdrEnable ? server.data.sdrIp : server.ip
    }:${server.data.sdrEnable ? server.data.sdrPort : server.port};${
      server.data.password.length > 0
        ? ` password ${server.data.password};`
        : ''
    }`;
    const tvConnect = `connect ${
      server.data.sdrEnable ? server.data.sdrIp : server.ip
    }:${server.data.sdrEnable ? server.data.sdrTvPort : server.data.tvPort};${
      server.data.tvPassword.length > 0
        ? ` password ${server.data.tvPassword}`
        : ''
    }`;

    // Create the embed.
    const embed = await this.buildBaseEmbed(
      'Match Details',
      `The server details for this match are ready\n**Connect String**\`\`\`${connect}\`\`\`\n**SourceTV Details**\`\`\`${tvConnect}\`\`\``,
    );
    embed.fields.push({
      name: 'Region',
      value: `\`${server.region}\``,
      inline: true,
    });

    // Add original IP in case of having connection issues (From Regi-Lighthouse)
    if (server.data.sdrEnable)
      embed.fields.push({
        name: 'Original IP',
        value: `Do not use this unless you have connection issues.\n\`${server.ip}:${server.port}\``,
        inline: false,
      });

    // Send server details
    return await channel.send({
      content: `@here`,
      embeds: [embed],
    });
  }

  // Run the bot
  private async run() {
    // Create a new Discord client
    this.bot = new Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_VOICE_STATES,
      ],
      botGuilds: [config.discord.guild],
    });

    // Event Handling
    //////////////////
    //
    // ready
    this.bot.once('ready', async () => {
      // Load all commands available
      try {
        await this.bot.initApplicationCommands({
          guild: { log: true, disable: { delete: true } },
          global: { log: true, disable: { delete: true } },
        });
      } catch (e) {
        this.logger.error(e);
      }

      // Load permissions
      await this.bot.initApplicationPermissions(true);

      // Prints out the available voice regions (for debugging)
      this.logger.debug(
        `Latest Regions List: ${(await this.bot.fetchVoiceRegions())
          .map((region) => region.id)
          .join(', ')}`,
      );

      // Log the bot is ready
      this.logger.log('Discord client initialized successfully.');
    });

    // interactionCreate
    this.bot.on('interactionCreate', (interaction: Interaction) => {
      if (interaction.guild.id !== config.discord.guild) return;

      this.bot.executeInteraction(interaction);
    });

    // Login to the bot user with the token provided.
    await this.bot.login(config.discord.token);
  }
}
