import { Logger } from '@nestjs/common';
import { ButtonInteraction, Intents, Interaction } from 'discord.js';
import { Client } from 'discordx';

import * as config from '../config.json';
import { ButtonType } from './objects/buttons/button-types.enum';
import { Player } from './objects/match-player.interface';

export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  // On instantiation, execute logic to run the bot.
  constructor() {
    this.run();
  }

  // Run the bot
  private async run() {
    // Create a new Discord client
    const bot = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
      botGuilds: [config.client.guild],
      silent: true,
    });

    // Event Handling
    //////////////////
    //
    // ready
    bot.once('ready', async () => {
      // Load all commands available
      await bot.initApplicationCommands({
        guild: { log: true, disable: { delete: true } },
        global: { log: true, disable: { delete: true } },
      });

      // Load permissions
      await bot.initApplicationPermissions(true);

      // Log the bot is ready
      console.log('The Discord bot is ready!');
    });

    // interactionCreate
    bot.on('interactionCreate', (interaction: Interaction) => {
      if (interaction.guild.id !== config.client.guild) return;

      bot.executeInteraction(interaction);
    });

    // Login to the bot user with the token provided.
    bot.login(config.client.token);
  }
}
