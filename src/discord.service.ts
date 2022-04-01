import { Logger } from '@nestjs/common';
import {
  CategoryChannel,
  Collection,
  GuildMember,
  Intents,
  Interaction,
  Message,
  MessageEmbed,
  OverwriteResolvable,
  Role,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { Client } from 'discordx';

import * as config from '../config.json';
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
      let category: CategoryChannel = undefined;

      if (config.lobbies.categoryId.length < 1 && !team.enabled)
        category = await guild.channels.create(`Lobby ${name}`, {
          type: 'GUILD_CATEGORY',
          reason:
            'This is an automatically generated category for Cytokine lobbies.',
        });
      else
        category = <CategoryChannel>(
          await guild.channels.fetch(
            team.enabled ? team.category : config.lobbies.categoryId,
          )
        );

      // Now that we have a category, create the General Text & Voice Channels.
      const gTextChannel = await category.createChannel(
          `${team.enabled ? team.text : config.lobbies.lobbyTextPrefix}${
            team.enabled ? '' : name
          }`,
          {
            type: 'GUILD_TEXT',
            reason:
              'This is an automatically generated text channel for Cytokine lobbies.',
            topic:
              '**This is a temporary channel for lobby chat.** This will be deleted after the lobby has been completed.',
            permissionOverwrites: permissions,
          },
        ),
        gVoiceChannel = await category.createChannel(
          `${team.enabled ? team.voice : config.lobbies.lobbyVoicePrefix}${
            team.enabled ? '' : name
          }`,
          {
            type: 'GUILD_VOICE',
            reason:
              'This is an automatically generated voice channel for Cytokine lobbies.',
            topic:
              '**This is a temporary channel for lobby voice.** This will be deleted after the lobby has been completed.',
            rtcRegion,
            permissionOverwrites: permissions,
          },
        );

      return {
        text: gTextChannel,
        voice: gVoiceChannel,
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
      lobby.channels.categoryId !== config.lobbies.categoryId
        ? lobby.channels.categoryId
        : undefined,
      lobby.channels.general.textChannelId,
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
    const embed = new MessageEmbed({
      title: 'Match Details',
      description: `The server details for this match are ready\n**Connect String**\`\`\`${connect}\`\`\`\n**SourceTV Details**\`\`\`${tvConnect}\`\`\``,
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
      fields: [
        {
          name: 'Region',
          value: `\`${server.region}\``,
          inline: true,
        },
      ],
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
