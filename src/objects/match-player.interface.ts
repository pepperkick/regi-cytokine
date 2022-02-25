import { RequirementName } from './requirement-names.enum';

export class Player {
  name: string;
  discord?: string;
  steam?: string;
  roles?: RequirementName[];
}
