import { RequirementName } from './requirement-names.enum';

export class FormatRequirement {
  // The RequirementName this format requirement is for
  name: RequirementName;

  // Amount allowed of this requirement
  // TODO: Adjust this for other games. Count makes sense for TF2 classes, but not for CS:GO for example.
  count: number;
}
