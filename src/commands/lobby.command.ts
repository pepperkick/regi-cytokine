import { CommandInteraction } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption, SlashChoice } from 'discordx';
import { Logger } from '@nestjs/common';
import { LobbyService } from '../modules/lobby/lobby.service';
import { LobbyOptions } from '../modules/lobby/lobby-options.interface';
import * as config from '../../config.json';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { Player } from '../objects/match-player.interface';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  static service: LobbyService;

  constructor(private readonly service: LobbyService) {
    LobbyCommand.service = service;
  }

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    // TODO: Properly support regions
    @SlashChoice({ Sydney: 'sydney' })
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
    if (interaction instanceof CommandInteraction) {
      const formatConfig = config.formats.filter(
        (item) => item.name === format,
      )[0] as LobbyFormat;

      if (!formatConfig) {
        return await interaction.reply({
          content: 'Unknown format',
          ephemeral: true,
        });
      }

      const player: Player = {
        name: interaction.user.username,
        discord: interaction.user.id,
        roles: ['creator'],
      };

      const options: LobbyOptions = {
        distribution: formatConfig.distribution,
        callbackUrl: config.localhost,
        queuedPlayers: [player],
        requirements: formatConfig.requirements,
        matchOptions: {
          region,
          game: formatConfig.game,
          callbackUrl: config.localhost,
          players: [],
        },
      };
      console.log(options);

      const lobby = await LobbyCommand.service.createLobby(options);

      if (!lobby) {
        return await interaction.reply(`Failed to create lobby`);
      }

      console.log(lobby);

      // Temporary reply until Lobby creation logic is finished.
      return await interaction.reply(
        `${format} at ${region} is what the user wants! ${lobby._id}`,
      );
    }
  }
}
