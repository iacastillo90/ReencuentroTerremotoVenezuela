import { PersonPayload } from '../validators/person.validator';

export interface ISourceAdapter<T = any> {
  sourceName: string;
  normalize(rawData: T): PersonPayload;
}
