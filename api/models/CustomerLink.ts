import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface ICustomerLink extends Document {
  userId: Types.ObjectId;          // your internal user _id
  paddleCustomerId: string;        // e.g. 'ctm_...'
  createdAt: Date;
  updatedAt: Date;
}

const CustomerLinkSchema = new Schema<ICustomerLink>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
    paddleCustomerId: { type: String, required: true, index: true, unique: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'customer_links', minimize: false }
);

CustomerLinkSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const CustomerLink: Model<ICustomerLink> =
  models.CustomerLink || model<ICustomerLink>('CustomerLink', CustomerLinkSchema);

export default CustomerLink;
