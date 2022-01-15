import { Logger } from '@nestjs/common';
import { Intents, Interaction, Message, TextChannel } from 'discord.js';
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
    const guild = await this.bot.guilds.fetch(config.client.guild);

    // Search for the channel inside the guild
    const channel = await guild.channels.fetch(config.client.channel);

    // Get the message from the channel
    if (channel instanceof TextChannel)
      return await channel.messages.fetch(messageId);
  }

  // Run the bot
  private async run() {
    // Create a new Discord client
    this.bot = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
      botGuilds: [config.client.guild],
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
      console.log('The Discord bot is ready!');
    });

    // interactionCreate
    this.bot.on('interactionCreate', (interaction: Interaction) => {
      if (interaction.guild.id !== config.client.guild) return;

      this.bot.executeInteraction(interaction);
    });

    // Login to the bot user with the token provided.
    this.bot.login(config.client.token);
  }
}
