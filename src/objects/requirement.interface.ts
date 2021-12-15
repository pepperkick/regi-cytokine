import { RequirementName } from './requirement-names.enum';

export class FormatRequirement {
  // The RequirementName this format requirement is for
  name: RequirementName;

  // Amount allowed of this requirement
  count: number;

  // Allow overfill for this role
  overfill?: boolean;
}
