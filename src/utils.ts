import { LobbyFormat } from './objects/lobby-format.interface';
import * as config from '../config.json';
import { LobbyType } from './objects/lobby-type.enum';
import { RequirementName } from './objects/requirement-names.enum';

/**
 * Parses the config's LobbyFormats and returns an array containing the LobbyFormat types.
 * @returns An object containing the SlashChoice LobbyFormat entries and a LobbyFormat array.
 */
export function ParseLobbyFormats() {
  let formatNames;
  let formats: LobbyFormat[];

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
        if (!Object.values(RequirementName).includes(<RequirementName>req.name))
          throw new Error(`${req.name} is not a valid requirement name!`);
      }

      // Add to respective arrays.
      this.formatNames[format.name] = format.name;
      this.formats.push(<LobbyFormat>format);
    } catch (e) {
      throw new Error(e);
    }
  }

  // Return both, names and formats.
  return { formats, formatNames };
}
