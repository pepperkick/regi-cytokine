import { Logger } from '@nestjs/common';
import { Client } from 'discordx';
import { LobbyFormat } from '../../objects/lobby-format.interface';
import * as config from '../../../config.json';
import { RequirementName } from '../../objects/requirement-names.enum';
import axios from 'axios';
import { LobbyOptions } from './lobby-options.interface';
import { DistributionType } from '../../objects/distribution.enum';
import { Player } from 'src/objects/match-player.interface';

export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  static formats = LobbyService.parseLobbyFormats();

  constructor(private readonly bot: Client) {}

  /**
   * Sends a request to Cytokine to create a new lobby with asked requirements.
   */
  async createLobby(options: LobbyOptions) {
    try {
      // Do a request to Cytokine to create a new lobby.
      // The format the data is sent in doesn't match the one from Cytokine's API.
      // This could be solved by discussing it this Friday (or before).
      //
      // data will be a Mongoose document with the Lobby's info.
      const { data } = await axios.post(
        `${config.localhost}/api/v1/lobbies`,
        options,
        {
          headers: { Authorization: `Bearer ${config.secret.cytokine}` },
        },
      );

      return data;
    } catch (error) {
      console.log(error.response.data);
    }
  }

  /**
   * Does a GET request to Cytokine to get a current lobby by its ID.
   * @param lobbyId The ID of the lobby to get.
   * @returns The API response with the lobby object.
   */
  async getLobby(lobbyId: string) {
    try {
      const { data } = await axios.get(
        `${config.localhost}/api/v1/lobbies/${lobbyId}`,
        {
          headers: { Authorization: `Bearer ${config.secret.cytokine}` },
        },
      );

      return data;
    } catch (error) {
      console.log(error.response.data);
    }
  }

  /**
   * Adds a player to a lobby's queue.
   * @param player The player to add.
   * @param lobby The lobby to add the player to.
   */
  async addPlayer(player: Player, lobby) {
    try {
      const { data } = await axios.post(
        `${config.localhost}/api/v1/lobbies/${lobby}/join`,
        player,
        {
          headers: { Authorization: `Bearer ${config.secret.cytokine}` },
        },
      );

      return data;
    } catch (error) {
      console.log(error.response.data);
    }
  }

  /**
   * Removes a player from a lobby's queue.
   * @param player The player to remove.
   * @param lobby The lobby to remove the player from.
   */
  async removePlayer(player: Player, lobby) {
    // TODO: Needs implementation in the backend.
  }

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

      // Format distribution type must belong to enum
      if (
        !Object.values(DistributionType).includes(
          <DistributionType>format.distribution,
        )
      )
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
