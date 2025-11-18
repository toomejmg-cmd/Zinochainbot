import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralReward extends Document {
  referralEdgeId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rewardType: string;
  layer?: number;
  transactionId?: mongoose.Types.ObjectId;
  tradeVolume: number;
  rewardAmount: number;
  rewardStatus: string;
  rewardPeriodStart?: Date;
  rewardPeriodEnd?: Date;
  paidAt?: Date;
  createdAt: Date;
}

const ReferralRewardSchema = new Schema<IReferralReward>({
  referralEdgeId: {
    type: Schema.Types.ObjectId,
    ref: 'ReferralEdge',
    default: null
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rewardType: {
    type: String,
    required: true,
    enum: ['tier', 'cashback']
  },
  layer: {
    type: Number,
    min: 1,
    max: 3,
    default: null
  },
  transactionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  tradeVolume: {
    type: Number,
    default: 0
  },
  rewardAmount: {
    type: Number,
    required: true
  },
  rewardStatus: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'queued', 'paid', 'failed'],
    index: true
  },
  rewardPeriodStart: { type: Date, default: null },
  rewardPeriodEnd: { type: Date, default: null },
  paidAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const ReferralReward = mongoose.model<IReferralReward>('ReferralReward', ReferralRewardSchema);
