import { CommandInteraction } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption, SlashChoice } from 'discordx';
import { Logger } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashOption('region', {
      description: 'The region the lobby will be in.',
      required: true,
    })
    region: string,
    @SlashChoice(LobbyService.formats.names)
    @SlashOption('format', {
      description: 'The format of the lobby.',
      required: true,
    })
    format: string,
    interaction: CommandInteraction,
  ) {
    if (interaction instanceof CommandInteraction)
      return await interaction.reply(
        `${format} at ${region} is what the user wants!`,
      );
  }
}
