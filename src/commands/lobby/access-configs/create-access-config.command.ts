import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { CommandInteraction } from 'discord.js';
import { PreferenceKeys, LobbyCommand } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-configs', 'lobby')
export class CreateAccessConfigCommand {
  @Slash('create', {
    description: 'Create a new access config for your lobbies',
  })
  async exec(
    @SlashOption('name', {
      description: `Type a name for your access config`,
      type: 'STRING',
    })
    name: string,
    interaction: CommandInteraction,
  ) {
    name = name.toLowerCase();
    const id = AccessConfigsCommand.getPrefId(interaction);

    let lobbyConfigs = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    if (!lobbyConfigs) {
      lobbyConfigs = {};
    }

    if (lobbyConfigs[name]) {
      return await interaction.reply({
        content: `Access config with the name '${name}' already exists.`,
        ephemeral: true,
      });
    }

    lobbyConfigs[name] = {
      name: name,
    };

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
      lobbyConfigs,
    );

    return await interaction.reply({
      content: `Access config '${name}' has been created!`,
      ephemeral: true,
    });
  }
}
