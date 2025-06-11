import usageRecordSchema from '~/schema/usageRecord';
import type * as t from '~/types';

/**
 * Creates or returns the UsageRecord model using the provided mongoose instance and schema
 */
export function createUsageRecordModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.UsageRecord || mongoose.model<t.IUsageRecord>('UsageRecord', usageRecordSchema);
}