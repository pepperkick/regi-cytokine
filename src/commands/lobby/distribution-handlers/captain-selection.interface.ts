import { RequirementName } from 'src/objects/requirement-names.enum';

export interface CaptainSelection {
  // The Discord ID of the player that got picked
  pick: string;

  // By who did they get picked.
  captain: string;

  // The role they've been picked as.
  role: RequirementName;
}
