import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralEdge extends Document {
  referrerAccountId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  layer: number;
  createdAt: Date;
}

const ReferralEdgeSchema = new Schema<IReferralEdge>({
  referrerAccountId: {
    type: Schema.Types.ObjectId,
    ref: 'ReferralAccount',
    required: true,
    index: true
  },
  referredUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  layer: {
    type: Number,
    required: true,
    min: 1,
    max: 3
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

ReferralEdgeSchema.index({ referrerAccountId: 1, referredUserId: 1, layer: 1 }, { unique: true });

export const ReferralEdge = mongoose.model<IReferralEdge>('ReferralEdge', ReferralEdgeSchema);
