import { Logger } from '@nestjs/common';
import { Client } from 'discordx';
import { LobbyFormat } from '../../objects/lobby-format.interface';
import * as config from '../../../config.json';
import { LobbyType } from '../../objects/lobby-type.enum';
import { RequirementName } from '../../objects/requirement-names.enum';
import axios from 'axios';

export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  static formats = LobbyService.parseLobbyFormats();

  constructor(private readonly bot: Client) {}

  /**
   * Sends a request to Cytokine to create a new lobby with asked requirements.
   */
  //async createLobby(region: String,

  /**
   * Parses the config's LobbyFormats and returns an array containing the LobbyFormat types.
   * @returns An object containing the SlashChoice LobbyFormat entries and a LobbyFormat array.
   */
  static parseLobbyFormats() {
    const formatNames = {};
    const formats: LobbyFormat[] = [];

    for (const format of config.formats) {
      // Parse the formats in the config file.
      // TODO: Add new games, for now it's only TF2.
      if (format.game !== 'tf2')
        // throw new Error(`${format.game} is not a supported game.`);
        continue;

      // Format type must belong to enum
      if (!Object.values(LobbyType).includes(<LobbyType>format.type))
        // throw new Error(`${format.type} is not a supported Lobby type.`);
        continue;

      // Parse requirements
      for (const req of format.requirements) {
        // req.name must belong to RequirementName
        if (!Object.values(RequirementName).includes(<RequirementName>req.name))
          throw new Error(`${req.name} is not a valid requirement name!`);
      }

      // Add to respective arrays.
      formatNames[format.name] = format.name;
      formats.push(<LobbyFormat>format);
    }

    // Return both, names and formats.
    return { names: formatNames, formats };
  }
}
