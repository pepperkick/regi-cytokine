import { CommandInteraction, Formatters } from 'discord.js';
import { Discord, SlashGroup, Slash, SlashOption, SlashChoice } from 'discordx';
import { LobbyFormat } from '../objects/lobby-format.interface';
import { RequirementName } from 'src/objects/requirement-names.enum';
import { LobbyType } from 'src/objects/lobby-type.enum';
import * as config from '../../config.json';
import { Logger } from '@nestjs/common';
//import { LobbyService } from '../lobby.service';

@Discord()
@SlashGroup('lobby', 'Interact with lobby options.')
export class LobbyCommand {
  formats = [];
  private readonly logger = new Logger(LobbyCommand.name);
  //static lobbyserv: LobbyService;

  constructor() {
    for (const format of config.formats) {
      try {
        // Parse the formats in the config file.
        // TODO: Add new games, for now it's only TF2.
        if (format.game !== 'tf2')
          throw new Error(`${format.game} is not a supported game.`);
        // Format type must belong to enum
        if (!Object.values(LobbyType).includes(<LobbyType>format.type))
          throw new Error(`${format.type} is not a supported Lobby type.`);
        // Parse requirements
        for (const req of format.requirements) {
          // req.name must belong to RequirementName
          if (
            !Object.values(RequirementName).includes(<RequirementName>req.name)
          )
            throw new Error(`${req.name} is not a valid requirement name!`);
        }
        this.formats.push(format);
        console.log(format);
      } catch (e) {
        console.log(e);
      }
    }
  }
  //constructor(private readonly lobbyService: LobbyService) { LobbyCommand.lobbyserv = lobbyService; }

  @Slash('create', { description: 'Create a new lobby for a pug.' })
  async create(
    @SlashOption('region', { description: 'The region the lobby will be in.' })
    region: string,
    //@SlashChoice()
    interaction: CommandInteraction,
  ) {
    if (interaction instanceof CommandInteraction)
      return await interaction.reply(`${region} is what the user wants!`);
  }
}
