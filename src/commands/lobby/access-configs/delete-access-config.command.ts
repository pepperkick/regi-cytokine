import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { AutocompleteInteraction, CommandInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-configs', 'lobby')
export class DeleteAccessConfigCommand {
  @Slash('delete', {
    description: 'Delete an access config',
  })
  async exec(
    @SlashOption('name', {
      description: `Type the access config name`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'name': {
          return AccessConfigsCommand.getNameChoices(interaction);
        }
      }

      return interaction.respond([]);
    }

    const id = AccessConfigsCommand.getPrefId(interaction);

    const lobbyConfigs = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    if (!lobbyConfigs[name]) {
      return await interaction.reply({
        content: `Access config with the name '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    delete lobbyConfigs[name];

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
      lobbyConfigs,
    );

    return await interaction.reply({
      content: `Access config '${name}' has been deleted.`,
      ephemeral: true,
    });
  }
}
