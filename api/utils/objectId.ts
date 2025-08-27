import { Types } from 'mongoose';

export const toObjectId = (v: unknown): Types.ObjectId | null => {
  if (v instanceof Types.ObjectId) return v;
  if (typeof v === 'string' && Types.ObjectId.isValid(v)) return new Types.ObjectId(v);
  return null;
};
