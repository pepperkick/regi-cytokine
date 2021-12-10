import { CommandInteraction, Formatters } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption, SlashChoice } from 'discordx';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';
import { LobbyType } from 'src/objects/lobby-type.enum';
import * as config from '../../config.json';
import { Logger } from '@nestjs/common';
//import { LobbyService } from '../lobby.service';

import { ParseLobbyFormats } from '../utils';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  private readonly logger = new Logger(LobbyCommand.name);
  //static lobbyserv: LobbyService;

  constructor(private readonly formats: LobbyFormat[]) {
    this.formats = ParseLobbyFormats().formats;
  }
  //constructor(private readonly lobbyService: LobbyService) { LobbyCommand.lobbyserv = lobbyService; }

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashOption('region', { description: 'The region the lobby will be in.' })
    region: string,
    @SlashChoice(ParseLobbyFormats().formatNames)
    @SlashOption('format', { description: 'The format of the lobby.' })
    interaction: CommandInteraction,
  ) {
    if (interaction instanceof CommandInteraction)
      return await interaction.reply(`${region} is what the user wants!`);
  }
}
