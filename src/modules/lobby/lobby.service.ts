import { Logger } from '@nestjs/common';
import { LobbyFormat } from '../../objects/lobby-format.interface';
import * as config from '../../../config.json';
import { RequirementName } from '../../objects/requirement-names.enum';
import axios from 'axios';
import { LobbyOptions } from './lobby-options.interface';
import { DistributionType } from '../../objects/distribution.enum';
import { Player } from 'src/objects/match-player.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lobby } from 'src/modules/lobby/lobby.model';
import { DiscordService } from 'src/discord.service';

interface LobbyChannels {
  categoryId: string;
  general: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
  teamA?: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
  teamB?: {
    textChannelId?: string;
    voiceChannelId?: string;
  };
}

export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  static formats = LobbyService.parseLobbyFormats();
  static regions = LobbyService.parseRegions();
  static discord: DiscordService;

  constructor(
    @InjectModel('Lobby') private readonly repo: Model<Lobby>,
    private readonly discord: DiscordService,
  ) {
    LobbyService.discord = discord;
  }

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
        `${config.cytokine.host}/api/v1/lobbies`,
        options,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(error.response.data);
    }
  }

  /**
   * Does a GET request to Cytokine to get a current lobby by its ID.
   * @param lobbyId The ID of the lobby to get.
   * @returns The API response with the lobby object, if found.
   */
  async getLobbyById(lobbyId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/lobbies/${lobbyId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(error.response.data);
    }
  }

  /**
   * Does a GET request to Cytokine to get a current lobby by its linked Match ID.
   * @param matchId The ID of the Match the Lobby will be linked to.
   * @returns The API response with the lobby object, if found.
   */
  async getLobbyByMatchId(matchId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/lobbies/match/${matchId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(error.response.data);
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
        `${config.cytokine.host}/api/v1/lobbies/${lobby}/join`,
        player,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(error.response.data);
    }
  }

  /**
   * Removes a player from a lobby's queue.
   * @param player The player Discord ID to remove from the queue.
   * @param lobby The lobby to remove the player from.
   */
  async removePlayer(playerId: string, lobby) {
    try {
      const { data } = await axios.delete(
        `${config.cytokine.host}/api/v1/lobbies/${lobby}/players/discord/${playerId}`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Player '${playerId}' request for removal from lobby '${lobby}' failed: ${error.response.data.error}`,
      );
    }
  }

  /**
   * Gets the server info for a Match.
   * @param matchId The ID of the Match to get the server info for.
   * @returns The server information from Lighthouse.
   */
  async getServerInfo(matchId: string) {
    try {
      const { data } = await axios.get(
        `${config.cytokine.host}/api/v1/matches/${matchId}/server`,
        {
          headers: { Authorization: `Bearer ${config.cytokine.secret}` },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(error.response.data);
    }
  }

  /**
   * Gets the amount of Lobby documents present in the collection.
   */
  async getLobbyCount(): Promise<number> {
    return <number>await this.repo.count();
  }

  /**
   * Creates a Discord Text & Voice channel for a lobby.
   */
  async createChannels() {
    return await LobbyService.discord.createLobbyChannels(
      await this.getLobbyCount(),
      { enabled: false },
    );
  }

  /**
   * Saves a new Lobby document to the database.
   */
  async saveLobby(
    lobbyId: string,
    creatorId: string,
    messageId: string,
    channels?: LobbyChannels,
  ) {
    // Create new Lobby document
    const info = await new this.repo({
      lobbyId,
      creatorId,
      messageId,
      channels,
    });

    // Return the saved document
    return await info.save();
  }

  /**
   * Updates a Lobby document in the database saving the new channels.
   * @param lobbyId The Lobby ID linked to the document.
   * @param channels The team channels to save.
   * @returns The new internal Lobby document.
   */
  async updateLobbyChannels(lobbyId, teamChannels: { A; B }) {
    try {
      // Get the internal Lobby document with this ID linked to it.
      const lobby = await this.getInternalLobbyById(lobbyId);

      // Update the new channel information.
      lobby.channels = {
        ...lobby.channels,
        teamA: {
          textChannelId: teamChannels.A.text.id,
          voiceChannelId: teamChannels.A.voice.id,
        },
        teamB: {
          textChannelId: teamChannels.B.text.id,
          voiceChannelId: teamChannels.B.voice.id,
        },
      };

      // Mark as modified and save it
      lobby.markModified('channels');
      await lobby.save();

      // Return the new internal Lobby document
      return lobby;
    } catch (e) {
      // Probably not found or some other error.
      this.logger.error(
        `Lobby '${lobbyId}' was requested for internal update but failed: ${e}.`,
      );
    }
  }

  /**
   * Gets the Lobby document for a lobby by its ID.
   */
  async getInternalLobbyById(lobbyId: string): Promise<Lobby> {
    return await this.repo.findOne({ lobbyId });
  }

  /**
   * Gets the Lobby document for a lobby by its Discord Message ID.
   */
  async getInternalLobbyByMessageId(messageId: string) {
    return await this.repo.findOne({ messageId });
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

  /**
   * Parses the config's listed regions into a list of options for LobbyCommand to offer.
   * @returns An object containing the SlashChoice region entries.
   */
  static parseRegions() {
    const regions = {};

    // TODO: Validate regions

    // Iterate through regions available in config, and create the enumerable object.
    for (const region of Object.keys(config.regions))
      regions[config.regions[region].name] = region;

    return regions;
  }
}
