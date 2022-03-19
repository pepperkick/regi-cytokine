import { Discord, SlashGroup } from 'discordx';
import { Module } from '@nestjs/common';
import { CreateAccessListCommand } from './access-lists/create-access-list.command';
import { DeleteAccessListCommand } from './access-lists/delete-access-list.command';
import { ViewAccessListCommand } from './access-lists/view-access-list.command';
import { ExportAccessListCommand } from './access-lists/export-access-list.command';
import { ImportAccessListCommand } from './access-lists/import-access-list.command';
import { AddPlayerToAccessListCommand } from './access-lists/add-player.command';
import { AddRoleToAccessListCommand } from './access-lists/add-role.command';
import { RemovePlayerFromAccessListCommand } from './access-lists/remove-player.command';
import { RemoveRoleFromAccessListCommand } from './access-lists/remove-role.command';
import { AutocompleteInteraction } from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../lobby.command';
import { AccessConfigsCommand } from './access-configs.command';

@Discord()
@SlashGroup({
  name: 'access-lists',
  root: 'lobby',
  description: 'Manage your lobby access lists.',
})
@Module({
  exports: [
    CreateAccessListCommand,
    DeleteAccessListCommand,
    ViewAccessListCommand,
    ExportAccessListCommand,
    ImportAccessListCommand,
    AddPlayerToAccessListCommand,
    AddRoleToAccessListCommand,
    RemovePlayerFromAccessListCommand,
    RemoveRoleFromAccessListCommand,
  ],
})
export class AccessListsCommand {
  static async getNameChoices(interaction: AutocompleteInteraction) {
    const id = AccessConfigsCommand.getPrefId(interaction);

    const names = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );

    const choices = [];
    if (names) {
      for (const name of Object.keys(names)) {
        choices.push({
          name: name,
          value: name,
        });
      }
    }

    return await interaction.respond(
      choices
        .filter((choice) =>
          choice.name.includes(
            <string>interaction.options.getFocused(true).value,
          ),
        )
        .slice(0, 24),
    );
  }
}
