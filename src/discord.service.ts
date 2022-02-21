import { Logger } from '@nestjs/common';
import {
  CategoryChannel,
  Intents,
  Interaction,
  Message,
  MessageEmbed,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { Client } from 'discordx';

import * as config from '../config.json';

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
   * Gets a Discord Message object from the message ID.
   */
  async getMessage(
    messageId: string,
  ): Promise<Message<true> | Message<boolean>> {
    // Get the Guild first
    const guild = await this.bot.guilds.fetch(config.discord.guild);

    // Search for the channel inside the guild
    const channel = await guild.channels.fetch(config.discord.channels.create);

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
      // TODO: More an idea than a TODO, but this could use permissions where the lobby players are the only ones that can see the channels.
      const gTextChannel = await category.createChannel(
          `${team.enabled ? team.name : config.lobbies.lobbyTextPrefix}${
            team.enabled ? '' : name
          }`,
          {
            type: 'GUILD_TEXT',
            reason:
              'This is an automatically generated text channel for Cytokine lobbies.',
            topic:
              '**This is a temporary channel for lobby chat.** This will be deleted after the lobby has been completed.',
          },
        ),
        gVoiceChannel = await category.createChannel(
          `${team.enabled ? team.name : config.lobbies.lobbyVoicePrefix}${
            team.enabled ? '' : name
          }`,
          {
            type: 'GUILD_VOICE',
            reason:
              'This is an automatically generated voice channel for Cytokine lobbies.',
            topic:
              '**This is a temporary channel for lobby voice.** This will be deleted after the lobby has been completed.',
            rtcRegion,
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
    // Create one for Team A
    const teamA = await this.createLobbyChannels(
        name,
        {
          name: 'Team A',
          category: categoryId,
          enabled: true,
        },
        region,
      ),
      // Create one for Team B
      teamB = await this.createLobbyChannels(
        name,
        {
          name: 'Team B',
          category: categoryId,
          enabled: true,
        },
        region,
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
            this.logger.error(
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
    // Create the embed.
    const embed = new MessageEmbed({
      title: "Ready or not, let's play!",
      description:
        'Be sure to join your respective **voice channels** before joining the server!',
      color: 0x37ef09,
      fields: [
        {
          name: `✍️ Manual Connect`,
          value: `Paste this into your game console.\n\n\`\`connect ${
            server.data.sdrEnable ? server.data.sdrIp : server.ip
          }:${server.data.sdrEnable ? server.data.sdrPort : server.port}; ${
            server.data.password.length > 0
              ? `password ${server.data.password}`
              : ''
          }\`\``,
          inline: true,
        },
        {
          name: `🔗 Link Connect`,
          value: `Click to join instantly!\n\nsteam://connect/${
            server.data.sdrEnable ? server.data.sdrIp : server.ip
          }:${server.data.sdrEnable ? server.data.sdrPort : server.port}/${
            server.data.password.length > 0 ? `${server.data.password}` : ''
          }`,
          inline: true,
        },
        {
          name: `📄 Server Details`,
          value: `**IP:** ${server.ip}:${server.port}\n**Password:** ${
            server.data.password.length > 0
              ? `${server.data.password}`
              : 'No Password'
          }`,
          inline: true,
        },
        {
          name: `🎥 SourceTV`,
          value: `In case you wish to spectate the lobby, these are the **SourceTV** details.\n\n\`\`connect ${
            server.data.sdrEnable ? server.data.sdrIp : server.ip
          }:${
            server.data.sdrEnable ? server.data.sdrTvPort : server.data.tvPort
          }; ${
            server.data.tvPassword.length > 0
              ? `password ${server.data.tvPassword}`
              : ''
          }\`\``,
          inline: true,
        },
      ],
    });

    // Send the message
    return await channel.send({
      content: '@here',
      embeds: [embed],
    });
  }

  // Run the bot
  private async run() {
    // Create a new Discord client
    this.bot = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
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
          guild: { log: true },
          global: { log: true },
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
