import planSchema from '~/schema/plan';
import type * as t from '~/types';

/**
 * Creates or returns the Plan model using the provided mongoose instance and schema
 */
export function createPlanModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Plan || mongoose.model<t.IPlan>('Plan', planSchema);
}