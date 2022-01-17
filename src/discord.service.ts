import { Logger } from '@nestjs/common';
import {
  CategoryChannel,
  Intents,
  Interaction,
  Message,
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
    const channel = await guild.channels.fetch(config.discord.channel);

    // Get the message from the channel
    if (channel instanceof TextChannel)
      return await channel.messages.fetch(messageId);
  }

  /**
   * Creates general Text & Voice channel for a lobby.
   */
  async createLobbyChannels(
    count: number,
    team?,
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
        category = await guild.channels.create(`Lobby #${count}`, {
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
            team.enabled ? '' : count
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
            team.enabled ? '' : count
          }`,
          {
            type: 'GUILD_VOICE',
            reason:
              'This is an automatically generated voice channel for Cytokine lobbies.',
            topic:
              '**This is a temporary channel for lobby voice.** This will be deleted after the lobby has been completed.',
          },
        );

      return {
        text: gTextChannel,
        voice: gVoiceChannel,
      };
    } catch (e) {
      // Probably missing permissions when creating channels.
      console.error(e);
    }
  }

  /**
   * Creates team specific channels, both Text and Voice.
   * This should be done after LOBBY_READY status is sent.
   */
  async createTeamChannels(categoryId: string): Promise<{
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
    const teamA = await this.createLobbyChannels(0, {
        name: 'Team A',
        category: categoryId,
        enabled: true,
      }),
      // Create one for Team B
      teamB = await this.createLobbyChannels(0, {
        name: 'Team B',
        category: categoryId,
        enabled: true,
      });

    return { teamA, teamB };
  }

  // Run the bot
  private async run() {
    // Create a new Discord client
    this.bot = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
      botGuilds: [config.discord.guild],
      silent: true,
    });

    // Event Handling
    //////////////////
    //
    // ready
    this.bot.once('ready', async () => {
      // Load all commands available
      await this.bot.initApplicationCommands({
        guild: { log: true, disable: { delete: true } },
        global: { log: true, disable: { delete: true } },
      });

      // Load permissions
      await this.bot.initApplicationPermissions(true);

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
